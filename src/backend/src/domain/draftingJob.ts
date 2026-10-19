import type { VersionStatus } from "./versionStatus";

export const DRAFTING_JOB_KINDS = ["policy_from_regulation", "rules_from_policy"] as const;
export type DraftingJobKind = (typeof DRAFTING_JOB_KINDS)[number];

export const DRAFTING_JOB_STATUSES = ["pending", "running", "succeeded", "failed"] as const;
export type DraftingJobStatus = (typeof DRAFTING_JOB_STATUSES)[number];

export const FINISHED_DRAFTING_JOB_STATUSES = [
  "succeeded",
  "failed",
] as const satisfies readonly DraftingJobStatus[];

export const REGULATION_SOURCE_KINDS = ["text", "markdown", "url"] as const;
export type RegulationSourceKind = (typeof REGULATION_SOURCE_KINDS)[number];

// The worker Lambda times out after 15 minutes; one minute of slack covers the launch and the final write.
export const DRAFTING_JOB_TIMEOUT_MS = 16 * 60 * 1000;

export type DraftedPolicyVersion = { id: string; policyId: string; status: VersionStatus };
export type DraftedRuleVersion = { id: string; ruleId: string; status: VersionStatus };

export type DraftingJob = {
  id: string;
  kind: DraftingJobKind;
  status: DraftingJobStatus;
  parentJobId: string | null;
  sourceKind: RegulationSourceKind | null;
  sourceUrl: string | null;
  scope: string | null;
  versionLabel: string | null;
  regulationId: string | null;
  regulationVersionId: string | null;
  policyVersionId: string | null;
  policyVersions: DraftedPolicyVersion[];
  ruleVersions: DraftedRuleVersion[];
  warnings: string[];
  errorMessage: string | null;
  attempts: number;
  createdBy: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export function isDraftingJobFinished(job: Pick<DraftingJob, "status">): boolean {
  return (FINISHED_DRAFTING_JOB_STATUSES as readonly DraftingJobStatus[]).includes(job.status);
}

// A crashed or timed-out worker never marks its job, so this runs on every read; the stored row stays unchanged.
export function reportTimedOutJob(job: DraftingJob, now: Date): DraftingJob {
  const unfinishedSince = job.startedAt ?? job.createdAt;

  if (isDraftingJobFinished(job) || now.getTime() - unfinishedSince.getTime() < DRAFTING_JOB_TIMEOUT_MS) {
    return job;
  }

  return {
    ...job,
    status: "failed",
    errorMessage: `The job did not finish within ${DRAFTING_JOB_TIMEOUT_MS / 60_000} minutes`,
  };
}
