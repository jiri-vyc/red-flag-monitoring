import { type DraftingJob, reportTimedOutJob } from "../../domain/draftingJob";
import { derivePastedVersionLabel, isAllowedRegulationSourceUrl } from "../../domain/regulationSource";
import { recordAuditEvent } from "../audit/auditLog";
import type { Clock } from "../clock";
import { BusinessRuleViolationError, NotFoundError, toErrorMessage } from "../errors";
import type { Page, PageRequest } from "../pagination";
import type { NewRegulation } from "../regulations/regulationRepository";
import type { RegulationUseCases } from "../regulations/regulationUseCases";
import type {
  DraftingJobFilter,
  DraftingJobLauncher,
  DraftingJobRepository,
  NewDraftingJob,
} from "./draftingJobPorts";

export type RegulationSource = { kind: "text" | "markdown"; content: string } | { kind: "url"; url: string };

// Null only for a URL source: the worker then derives the regulation from the fetched page.
export type RegulationTarget =
  { kind: "existing"; regulationId: string } | { kind: "new"; regulation: NewRegulation } | null;

export type StartPolicyJobCommand = {
  source: RegulationSource;
  regulation: RegulationTarget;
  versionLabel: string | null;
  scope: string | null;
  createdBy: string;
};

export class DraftingJobUseCases {
  constructor(
    private readonly dependencies: {
      draftingJobRepository: DraftingJobRepository;
      draftingJobLauncher: DraftingJobLauncher;
      regulationUseCases: RegulationUseCases;
      clock: Clock;
    },
  ) {}

  async startPolicyJob(command: StartPolicyJobCommand): Promise<DraftingJob> {
    const { source } = command;

    if (source.kind === "url" && !isAllowedRegulationSourceUrl(source.url)) {
      throw new BusinessRuleViolationError("Regulations can only be fetched from allowed https sources");
    }

    if (source.kind !== "url" && command.regulation === null) {
      throw new BusinessRuleViolationError("Pasted regulation text needs a regulation to belong to");
    }

    const regulationId = await this.resolveRegulationId(command.regulation);
    const regulationVersionId =
      source.kind === "url" || regulationId === null
        ? null
        : await this.createPastedVersion(regulationId, source.content, command.versionLabel);

    return this.createAndLaunchJob({
      kind: "policy_from_regulation",
      parentJobId: null,
      sourceKind: source.kind,
      sourceUrl: source.kind === "url" ? source.url : null,
      scope: command.scope,
      versionLabel: source.kind === "url" ? command.versionLabel : null,
      regulationId,
      regulationVersionId,
      policyVersionId: null,
      createdBy: command.createdBy,
    });
  }

  async startPolicyJobForVersion(input: {
    regulationId: string;
    regulationVersionId: string;
    createdBy: string;
  }): Promise<DraftingJob> {
    await this.dependencies.regulationUseCases.getVersion(input.regulationId, input.regulationVersionId);

    return this.createAndLaunchJob({
      kind: "policy_from_regulation",
      parentJobId: null,
      sourceKind: "text",
      sourceUrl: null,
      scope: null,
      versionLabel: null,
      regulationId: input.regulationId,
      regulationVersionId: input.regulationVersionId,
      policyVersionId: null,
      createdBy: input.createdBy,
    });
  }

  async listJobs(filter: DraftingJobFilter, page: PageRequest): Promise<Page<DraftingJob>> {
    const now = this.dependencies.clock();
    const jobs = await this.dependencies.draftingJobRepository.listJobs({ filter, page, now });

    return { ...jobs, items: jobs.items.map((job) => reportTimedOutJob(job, now)) };
  }

  async getJob(jobId: string): Promise<DraftingJob> {
    const job = await this.dependencies.draftingJobRepository.findJob(jobId);

    if (!job) {
      throw new NotFoundError("Drafting job", jobId);
    }

    return reportTimedOutJob(job, this.dependencies.clock());
  }

  async retryJob(jobId: string): Promise<DraftingJob> {
    const job = await this.getJob(jobId);

    if (job.status !== "failed") {
      throw new BusinessRuleViolationError(`Only a failed job can be retried, job ${jobId} is ${job.status}`);
    }

    return this.createAndLaunchJob({
      kind: job.kind,
      parentJobId: job.parentJobId,
      sourceKind: job.sourceKind,
      sourceUrl: job.sourceUrl,
      scope: job.scope,
      versionLabel: job.versionLabel,
      regulationId: job.regulationId,
      regulationVersionId: job.regulationVersionId,
      policyVersionId: job.policyVersionId,
      createdBy: job.createdBy,
    });
  }

  findPolicyJobIdForPolicy(policyId: string): Promise<string | null> {
    return this.dependencies.draftingJobRepository.findPolicyJobIdForPolicy(policyId);
  }

  async launchStoredJob(jobId: string): Promise<DraftingJob> {
    return this.launchCreatedJob(await this.getJob(jobId));
  }

  private async createAndLaunchJob(job: NewDraftingJob): Promise<DraftingJob> {
    const created = await this.dependencies.draftingJobRepository.createJob(job);

    recordAuditEvent({
      action: "drafting_job.created",
      entityType: "drafting_job",
      entityId: created.id,
      actorId: job.createdBy,
      payload: {
        kind: job.kind,
        parentJobId: job.parentJobId,
        sourceKind: job.sourceKind,
        regulationVersionId: job.regulationVersionId,
        policyVersionId: job.policyVersionId,
      },
    });

    return this.launchCreatedJob(created);
  }

  // A job the launcher could not start would stay pending until the timeout, so it is failed right away. The
  // caller still gets the job: the approval that created a rules job is already committed.
  private async launchCreatedJob(job: DraftingJob): Promise<DraftingJob> {
    try {
      await this.dependencies.draftingJobLauncher.launchJob(job.id);

      return job;
    } catch (error) {
      console.error(`Drafting job ${job.id} could not be launched`, error);
      const failure = {
        jobId: job.id,
        errorMessage: `The job could not be launched: ${toErrorMessage(error)}`,
        finishedAt: this.dependencies.clock(),
      };

      await this.dependencies.draftingJobRepository.markJobFailed(failure);

      return { ...job, status: "failed", errorMessage: failure.errorMessage, finishedAt: failure.finishedAt };
    }
  }

  private async resolveRegulationId(target: RegulationTarget): Promise<string | null> {
    const { regulationUseCases } = this.dependencies;

    if (target === null) {
      return null;
    }

    if (target.kind === "existing") {
      return (await regulationUseCases.getRegulation(target.regulationId)).id;
    }

    return (await regulationUseCases.createRegulation(target.regulation)).id;
  }

  private async createPastedVersion(
    regulationId: string,
    fullText: string,
    versionLabel: string | null,
  ): Promise<string> {
    const version = await this.dependencies.regulationUseCases.createVersion({
      regulationId,
      label: versionLabel ?? derivePastedVersionLabel(this.dependencies.clock()),
      fullText,
    });

    return version.id;
  }
}
