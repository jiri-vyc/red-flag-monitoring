import type { DraftingJob } from "../../domain/draftingJob";
import type { Regulation, RegulationVersion } from "../../domain/regulation";
import {
  deriveRegulationCodeFromUrl,
  deriveUrlVersionLabel,
  URL_REGULATION_KIND,
} from "../../domain/regulationSource";
import { findRuleLogicViolation } from "../../domain/rule";
import type { Clock } from "../clock";
import { BusinessRuleViolationError, NotFoundError, toErrorMessage } from "../errors";
import type { InternalPolicyRepository } from "../internalPolicies/internalPolicyRepository";
import type { RegulationRepository } from "../regulations/regulationRepository";
import type { DraftGenerator, RuleDraft } from "./draftGenerator";
import type { DraftingJobRepository, RegulationSourceFetcher } from "./draftingJobPorts";

type RegulationWithVersion = { regulation: Regulation; version: RegulationVersion };

export class DraftingJobExecutor {
  constructor(
    private readonly dependencies: {
      draftingJobRepository: DraftingJobRepository;
      draftGenerator: DraftGenerator;
      regulationRepository: RegulationRepository;
      internalPolicyRepository: InternalPolicyRepository;
      regulationSourceFetcher: RegulationSourceFetcher;
      clock: Clock;
    },
  ) {}

  async executeJob(jobId: string): Promise<void> {
    const { draftingJobRepository, clock } = this.dependencies;
    const job = await draftingJobRepository.claimJob(jobId, clock());

    if (!job) {
      console.warn(`Drafting job ${jobId} is not pending, skipping`);
      return;
    }

    const startedAt = clock();

    console.log(`Drafting job ${jobId} (${job.kind}) started, attempt ${job.attempts}`);

    try {
      if (job.kind === "policy_from_regulation") {
        await this.draftPolicies(job);
      } else {
        await this.draftRules(job);
      }

      console.log(`Drafting job ${jobId} succeeded after ${formatDuration(startedAt, clock())}`);
    } catch (error) {
      console.error(
        `Drafting job ${jobId} failed after ${formatDuration(startedAt, clock())}: ${toErrorMessage(error)}`,
      );
      await draftingJobRepository.markJobFailed({
        jobId,
        errorMessage: toErrorMessage(error),
        finishedAt: clock(),
      });

      throw error;
    }
  }

  private async draftPolicies(job: DraftingJob): Promise<void> {
    const { regulation, version } = await this.loadRegulationVersion(job);
    const drafts = await this.dependencies.draftGenerator.draftPolicies(regulation, version, job.scope);

    await this.dependencies.draftingJobRepository.completePolicyJob({
      jobId: job.id,
      createdBy: job.createdBy,
      drafts,
      warnings: [],
      finishedAt: this.dependencies.clock(),
    });
  }

  private async draftRules(job: DraftingJob): Promise<void> {
    const { internalPolicyRepository, draftGenerator, draftingJobRepository, clock } = this.dependencies;
    const policyVersionId = requireValue(job.policyVersionId, "policyVersionId", job);
    const version = await internalPolicyRepository.findVersion(policyVersionId);

    if (!version) {
      throw new NotFoundError("Internal policy version", policyVersionId);
    }

    const policy = await internalPolicyRepository.findPolicy(version.policyId);

    if (!policy) {
      throw new NotFoundError("Internal policy", version.policyId);
    }

    const drafts = await draftGenerator.draftRules(policy, version);
    const validDrafts = drafts.filter((draft) => findRuleDraftViolation(draft) === null);
    const warnings = drafts.flatMap((draft) => {
      const violation = findRuleDraftViolation(draft);
      return violation ? [`Rule draft ${draft.code} was skipped: ${violation}`] : [];
    });

    await draftingJobRepository.completeRulesJob({
      jobId: job.id,
      createdBy: job.createdBy,
      policyId: policy.id,
      policyVersionId,
      drafts: validDrafts,
      warnings,
      finishedAt: clock(),
    });
  }

  private async loadRegulationVersion(job: DraftingJob): Promise<RegulationWithVersion> {
    if (job.regulationVersionId === null) {
      return this.fetchRegulationVersion(job);
    }

    const { regulationRepository } = this.dependencies;
    const version = await regulationRepository.findVersion(job.regulationVersionId);

    if (!version) {
      throw new NotFoundError("Regulation version", job.regulationVersionId);
    }

    const regulation = await regulationRepository.findRegulation(version.regulationId);

    if (!regulation) {
      throw new NotFoundError("Regulation", version.regulationId);
    }

    return { regulation, version };
  }

  // The fetched wording is stored before drafting, so a retry of a failed job does not fetch the URL again.
  private async fetchRegulationVersion(job: DraftingJob): Promise<RegulationWithVersion> {
    const { regulationSourceFetcher, regulationRepository, draftingJobRepository, clock } = this.dependencies;
    const sourceUrl = requireValue(job.sourceUrl, "sourceUrl", job);
    const fetched = await regulationSourceFetcher.fetchSource(sourceUrl);

    if (fetched.text.trim() === "") {
      throw new BusinessRuleViolationError(`No regulation text found at ${sourceUrl}`);
    }

    const fetchedAt = clock();
    const regulation = await this.findOrCreateUrlRegulation(job, sourceUrl, fetched.title, fetchedAt);
    const version = await regulationRepository.createVersion({
      regulationId: regulation.id,
      label: job.versionLabel ?? deriveUrlVersionLabel(fetchedAt),
      fullText: fetched.text,
    });

    await draftingJobRepository.attachRegulationVersion({
      jobId: job.id,
      regulationId: regulation.id,
      regulationVersionId: version.id,
    });

    return { regulation, version };
  }

  private async findOrCreateUrlRegulation(
    job: DraftingJob,
    sourceUrl: string,
    pageTitle: string | null,
    fetchedAt: Date,
  ): Promise<Regulation> {
    const { regulationRepository } = this.dependencies;

    if (job.regulationId !== null) {
      const regulation = await regulationRepository.findRegulation(job.regulationId);

      if (!regulation) {
        throw new NotFoundError("Regulation", job.regulationId);
      }

      return regulation;
    }

    const knownRegulation = await regulationRepository.findRegulationBySourceUrl(sourceUrl);

    if (knownRegulation) {
      return knownRegulation;
    }

    return regulationRepository.createRegulation({
      code: deriveRegulationCodeFromUrl(sourceUrl),
      title: pageTitle ?? sourceUrl,
      kind: URL_REGULATION_KIND,
      sourceUrl,
      checkedAt: fetchedAt,
    });
  }
}

// M5: a rule version without its own legal basis has no path to the regulation.
function findRuleDraftViolation(draft: RuleDraft): string | null {
  return (
    findRuleLogicViolation(draft.kind, draft) ??
    (draft.legalBases.length === 0 ? "a rule version needs at least one legal basis" : null)
  );
}

function requireValue<Value>(value: Value | null, field: string, job: DraftingJob): Value {
  if (value === null) {
    throw new BusinessRuleViolationError(`Drafting job ${job.id} (${job.kind}) has no ${field}`);
  }

  return value;
}

function formatDuration(startedAt: Date, finishedAt: Date): string {
  return `${((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)}s`;
}
