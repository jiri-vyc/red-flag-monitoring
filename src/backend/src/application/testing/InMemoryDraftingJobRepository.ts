import { type DraftingJob, reportTimedOutJob } from "../../domain/draftingJob";
import type {
  DraftingJobFailure,
  DraftingJobFilter,
  DraftingJobRepository,
  NewDraftingJob,
  PolicyJobCompletion,
  RulesJobCompletion,
} from "../drafting/draftingJobPorts";
import { ConflictError } from "../errors";
import type { Page, PageRequest } from "../pagination";
import type { InMemoryInternalPolicyRepository } from "./InMemoryInternalPolicyRepository";
import type { InMemoryRuleRepository } from "./InMemoryRuleRepository";
import { DEFAULT_ESCALATION_ROLE } from "../../domain/rule";

// Mirrors the conditional updates of TypeOrmDraftingJobRepository; drafts are written to the given fakes.
export class InMemoryDraftingJobRepository implements DraftingJobRepository {
  readonly jobs = new Map<string, DraftingJob>();
  private nextId = 1;

  constructor(
    private readonly internalPolicyRepository: InMemoryInternalPolicyRepository,
    private readonly ruleRepository: InMemoryRuleRepository,
    private readonly createdAt: Date,
  ) {}

  async createJob(job: NewDraftingJob): Promise<DraftingJob> {
    const created: DraftingJob = {
      ...job,
      id: `job-${this.nextId++}`,
      status: "pending",
      policyVersions: [],
      ruleVersions: [],
      warnings: [],
      errorMessage: null,
      attempts: 0,
      createdAt: this.createdAt,
      startedAt: null,
      finishedAt: null,
    };
    this.jobs.set(created.id, created);

    return created;
  }

  async findJob(jobId: string): Promise<DraftingJob | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async listJobs(query: {
    filter: DraftingJobFilter;
    page: PageRequest;
    now: Date;
  }): Promise<Page<DraftingJob>> {
    const { filter, page, now } = query;
    const items = [...this.jobs.values()].filter(
      (job) =>
        (!filter.statuses || filter.statuses.includes(reportTimedOutJob(job, now).status)) &&
        (!filter.kinds || filter.kinds.includes(job.kind)) &&
        (!filter.regulationId || job.regulationId === filter.regulationId) &&
        (!filter.policyVersionId || job.policyVersionId === filter.policyVersionId),
    );

    return { ...page, total: items.length, items: items.slice(page.offset, page.offset + page.limit) };
  }

  async findPolicyJobIdForPolicy(policyId: string): Promise<string | null> {
    const job = [...this.jobs.values()].find((candidate) =>
      candidate.policyVersions.some((version) => version.policyId === policyId),
    );

    return job?.id ?? null;
  }

  async claimJob(jobId: string, startedAt: Date): Promise<DraftingJob | null> {
    const job = this.jobs.get(jobId);

    if (job?.status !== "pending") {
      return null;
    }

    return this.update(jobId, { status: "running", startedAt, attempts: job.attempts + 1 });
  }

  async attachRegulationVersion(input: {
    jobId: string;
    regulationId: string;
    regulationVersionId: string;
  }): Promise<void> {
    this.update(input.jobId, {
      regulationId: input.regulationId,
      regulationVersionId: input.regulationVersionId,
    });
  }

  async completePolicyJob(completion: PolicyJobCompletion): Promise<void> {
    this.getRunningJob(completion.jobId);
    const policyVersions = [];

    for (const draft of completion.drafts) {
      const policy = await this.internalPolicyRepository.createPolicy({
        code: draft.code,
        title: draft.title,
      });
      const version = await this.internalPolicyRepository.createVersion({
        policyId: policy.id,
        body: draft.body,
        legalBases: draft.legalBases,
        status: "draft",
        createdVia: "wizard",
        createdBy: completion.createdBy,
      });

      policyVersions.push({ id: version.id, policyId: policy.id, status: version.status });
    }

    this.update(completion.jobId, {
      status: "succeeded",
      policyVersions,
      warnings: completion.warnings,
      finishedAt: completion.finishedAt,
    });
  }

  async completeRulesJob(completion: RulesJobCompletion): Promise<void> {
    this.getRunningJob(completion.jobId);
    const ruleVersions = [];

    for (const { code, alertType, kind, isWhitelistAllowed, ...logic } of completion.drafts) {
      const rule = await this.ruleRepository.createRule({
        policyId: completion.policyId,
        code,
        alertType,
        kind,
        isWhitelistAllowed,
      });
      const version = await this.ruleRepository.createVersion({
        ...logic,
        ruleId: rule.id,
        derivedFromPolicyVersionId: completion.policyVersionId,
        // Drafts start with the default escalation; the compliance officer may change it at review (E2).
        escalationRole: DEFAULT_ESCALATION_ROLE,
        status: "draft",
        createdVia: "wizard",
        createdBy: completion.createdBy,
      });

      ruleVersions.push({ id: version.id, ruleId: rule.id, status: version.status });
    }

    this.update(completion.jobId, {
      status: "succeeded",
      ruleVersions,
      warnings: completion.warnings,
      finishedAt: completion.finishedAt,
    });
  }

  async markJobFailed(failure: DraftingJobFailure): Promise<void> {
    const job = this.jobs.get(failure.jobId);

    if (job?.status === "pending" || job?.status === "running") {
      this.update(failure.jobId, {
        status: "failed",
        errorMessage: failure.errorMessage,
        finishedAt: failure.finishedAt,
      });
    }
  }

  private getRunningJob(jobId: string): DraftingJob {
    const job = this.jobs.get(jobId);

    if (job?.status !== "running") {
      throw new ConflictError(`Drafting job ${jobId} is no longer running`);
    }

    return job;
  }

  private update(jobId: string, changes: Partial<DraftingJob>): DraftingJob {
    const updated = { ...(this.jobs.get(jobId) as DraftingJob), ...changes };
    this.jobs.set(jobId, updated);

    return updated;
  }
}
