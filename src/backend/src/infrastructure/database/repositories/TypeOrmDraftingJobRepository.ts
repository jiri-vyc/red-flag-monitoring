import { type DataSource, type EntityManager, In, type SelectQueryBuilder } from "typeorm";

import {
  DRAFTING_JOB_TIMEOUT_MS,
  type DraftedPolicyVersion,
  type DraftedRuleVersion,
  type DraftingJob,
} from "../../../domain/draftingJob";
import type {
  DraftingJobFailure,
  DraftingJobFilter,
  DraftingJobRepository,
  NewDraftingJob,
  PolicyJobCompletion,
  RulesJobCompletion,
} from "../../../application/drafting/draftingJobPorts";
import { ConflictError } from "../../../application/errors";
import type { Page, PageRequest } from "../../../application/pagination";
import { DraftingJobEntity } from "../entities/DraftingJobEntity";
import { InternalPolicyVersionEntity } from "../entities/InternalPolicyVersionEntity";
import { RuleVersionEntity } from "../entities/RuleVersionEntity";
import { translateDatabaseErrors } from "../translateDatabaseErrors";
import { insertDraftingJob } from "./draftingJobWrites";
import { insertPolicy, insertPolicyVersion } from "./policyWrites";
import { insertRule, insertRuleVersion } from "./ruleWrites";
import { DEFAULT_ALERT_GRANULARITY, DEFAULT_ESCALATION_ROLE } from "../../../domain/rule";

// Mirrors reportTimedOutJob, so a status filter matches the status the API reports.
const REPORTED_STATUS_SQL = `CASE
  WHEN job.status IN ('pending', 'running') AND COALESCE(job.started_at, job.created_at) <= :timedOutBefore
  THEN 'failed'
  ELSE job.status
END`;

type JobFinish = Pick<DraftingJobEntity, "draftedPolicyVersionIds" | "draftedRuleVersionIds" | "warnings"> & {
  finishedAt: Date;
};

export class TypeOrmDraftingJobRepository implements DraftingJobRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createJob(job: NewDraftingJob): Promise<DraftingJob> {
    const saved = await translateDatabaseErrors(() => insertDraftingJob(this.dataSource.manager, job));

    return toDraftingJob(saved, [], []);
  }

  async findJob(jobId: string): Promise<DraftingJob | null> {
    const entity = await this.dataSource.getRepository(DraftingJobEntity).findOneBy({ id: jobId });
    const [job] = entity ? await this.withDraftedVersions([entity]) : [];

    return job ?? null;
  }

  async listJobs(query: {
    filter: DraftingJobFilter;
    page: PageRequest;
    now: Date;
  }): Promise<Page<DraftingJob>> {
    const { filter, page, now } = query;
    const builder = this.dataSource
      .getRepository(DraftingJobEntity)
      .createQueryBuilder("job")
      .orderBy("job.createdAt", "DESC")
      .addOrderBy("job.id", "ASC")
      .skip(page.offset)
      .take(page.limit);

    applyFilter(builder, filter, new Date(now.getTime() - DRAFTING_JOB_TIMEOUT_MS));
    const [entities, total] = await builder.getManyAndCount();

    return { ...page, total, items: await this.withDraftedVersions(entities) };
  }

  async findPolicyJobIdForPolicy(policyId: string): Promise<string | null> {
    const job = await this.dataSource
      .getRepository(DraftingJobEntity)
      .createQueryBuilder("job")
      .select("job.id", "id")
      .where("job.kind = 'policy_from_regulation'")
      .andWhere(
        `EXISTS (SELECT 1 FROM internal_policy_versions version
          WHERE version.policy_id = :policyId AND version.id = ANY(job.drafted_policy_version_ids))`,
        { policyId },
      )
      .orderBy("job.created_at", "DESC")
      .limit(1)
      .getRawOne<{ id: string }>();

    return job?.id ?? null;
  }

  async claimJob(jobId: string, startedAt: Date): Promise<DraftingJob | null> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(DraftingJobEntity)
      .set({ status: "running", startedAt, attempts: () => "attempts + 1" })
      .where("id = :jobId AND status = 'pending'", { jobId })
      .execute();

    return result.affected === 1 ? this.findJob(jobId) : null;
  }

  async attachRegulationVersion(input: {
    jobId: string;
    regulationId: string;
    regulationVersionId: string;
  }): Promise<void> {
    await this.dataSource
      .getRepository(DraftingJobEntity)
      .update(
        { id: input.jobId },
        { regulationId: input.regulationId, regulationVersionId: input.regulationVersionId },
      );
  }

  completePolicyJob(completion: PolicyJobCompletion): Promise<void> {
    return translateDatabaseErrors(() =>
      this.dataSource.transaction(async (manager) => {
        const draftedPolicyVersionIds: string[] = [];

        for (const draft of completion.drafts) {
          const policy = await insertPolicy(manager, { code: draft.code, title: draft.title });
          const version = await insertPolicyVersion(manager, {
            policyId: policy.id,
            body: draft.body,
            legalBases: draft.legalBases,
            status: "draft",
            createdVia: "wizard",
            createdBy: completion.createdBy,
          });

          draftedPolicyVersionIds.push(version.id);
        }

        await succeedRunningJob(manager, completion.jobId, {
          draftedPolicyVersionIds,
          draftedRuleVersionIds: [],
          warnings: completion.warnings,
          finishedAt: completion.finishedAt,
        });
      }),
    );
  }

  completeRulesJob(completion: RulesJobCompletion): Promise<void> {
    return translateDatabaseErrors(() =>
      this.dataSource.transaction(async (manager) => {
        const draftedRuleVersionIds: string[] = [];

        for (const { code, alertType, kind, isWhitelistAllowed, ...logic } of completion.drafts) {
          const rule = await insertRule(manager, {
            policyId: completion.policyId,
            code,
            alertType,
            alertGranularity: DEFAULT_ALERT_GRANULARITY,
            kind,
            isWhitelistAllowed,
          });
          const version = await insertRuleVersion(manager, {
            ...logic,
            ruleId: rule.id,
            derivedFromPolicyVersionId: completion.policyVersionId,
            // Drafts start with the default escalation; the compliance officer may change it at review (E2).
            escalationRole: DEFAULT_ESCALATION_ROLE,
            status: "draft",
            createdVia: "wizard",
            createdBy: completion.createdBy,
          });

          draftedRuleVersionIds.push(version.id);
        }

        await succeedRunningJob(manager, completion.jobId, {
          draftedPolicyVersionIds: [],
          draftedRuleVersionIds,
          warnings: completion.warnings,
          finishedAt: completion.finishedAt,
        });
      }),
    );
  }

  async markJobFailed(failure: DraftingJobFailure): Promise<void> {
    await this.dataSource
      .getRepository(DraftingJobEntity)
      .update(
        { id: failure.jobId, status: In(["pending", "running"]) },
        { status: "failed", errorMessage: failure.errorMessage, finishedAt: failure.finishedAt },
      );
  }

  private async withDraftedVersions(entities: DraftingJobEntity[]): Promise<DraftingJob[]> {
    const policyVersionIds = entities.flatMap((entity) => entity.draftedPolicyVersionIds);
    const ruleVersionIds = entities.flatMap((entity) => entity.draftedRuleVersionIds);
    const [policyVersions, ruleVersions] = await Promise.all([
      policyVersionIds.length === 0
        ? []
        : this.dataSource.getRepository(InternalPolicyVersionEntity).find({
            select: { id: true, policyId: true, status: true },
            where: { id: In(policyVersionIds) },
          }),
      ruleVersionIds.length === 0
        ? []
        : this.dataSource.getRepository(RuleVersionEntity).find({
            select: { id: true, ruleId: true, status: true },
            where: { id: In(ruleVersionIds) },
          }),
    ]);
    const policyVersionById = new Map(
      policyVersions.map(({ id, policyId, status }) => [id, { id, policyId, status }]),
    );
    const ruleVersionById = new Map(
      ruleVersions.map(({ id, ruleId, status }) => [id, { id, ruleId, status }]),
    );

    return entities.map((entity) =>
      toDraftingJob(
        entity,
        pickExisting(entity.draftedPolicyVersionIds, policyVersionById),
        pickExisting(entity.draftedRuleVersionIds, ruleVersionById),
      ),
    );
  }
}

function applyFilter(
  builder: SelectQueryBuilder<DraftingJobEntity>,
  filter: DraftingJobFilter,
  timedOutBefore: Date,
): void {
  if (filter.statuses) {
    builder.andWhere(`(${REPORTED_STATUS_SQL}) IN (:...statuses)`, {
      statuses: filter.statuses,
      timedOutBefore,
    });
  }

  if (filter.kinds) {
    builder.andWhere("job.kind IN (:...kinds)", { kinds: filter.kinds });
  }

  if (filter.regulationId) {
    builder.andWhere("job.regulation_id = :regulationId", { regulationId: filter.regulationId });
  }

  if (filter.policyVersionId) {
    builder.andWhere("job.policy_version_id = :policyVersionId", { policyVersionId: filter.policyVersionId });
  }
}

// Conditional on `running`, so a job failed in the meantime (timeout, duplicate invocation) rolls the drafts back.
async function succeedRunningJob(manager: EntityManager, jobId: string, finish: JobFinish): Promise<void> {
  const result = await manager.update(
    DraftingJobEntity,
    { id: jobId, status: "running" },
    { ...finish, status: "succeeded" },
  );

  if (result.affected === 0) {
    throw new ConflictError(`Drafting job ${jobId} is no longer running`);
  }
}

function pickExisting<Version>(ids: string[], versionById: Map<string, Version>): Version[] {
  return ids.flatMap((id) => {
    const version = versionById.get(id);
    return version ? [version] : [];
  });
}

function toDraftingJob(
  entity: DraftingJobEntity,
  policyVersions: DraftedPolicyVersion[],
  ruleVersions: DraftedRuleVersion[],
): DraftingJob {
  return {
    id: entity.id,
    kind: entity.kind,
    status: entity.status,
    parentJobId: entity.parentJobId,
    sourceKind: entity.sourceKind,
    sourceUrl: entity.sourceUrl,
    scope: entity.scope,
    versionLabel: entity.versionLabel,
    regulationId: entity.regulationId,
    regulationVersionId: entity.regulationVersionId,
    policyVersionId: entity.policyVersionId,
    policyVersions,
    ruleVersions,
    warnings: entity.warnings,
    errorMessage: entity.errorMessage,
    attempts: entity.attempts,
    createdBy: entity.createdBy,
    createdAt: entity.createdAt,
    startedAt: entity.startedAt,
    finishedAt: entity.finishedAt,
  };
}
