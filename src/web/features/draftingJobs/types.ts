export const DRAFTING_JOB_KINDS = ["policy_from_regulation", "rules_from_policy"] as const;
export type DraftingJobKind = (typeof DRAFTING_JOB_KINDS)[number];

export const DRAFTING_JOB_STATUSES = ["pending", "running", "succeeded", "failed"] as const;
export type DraftingJobStatus = (typeof DRAFTING_JOB_STATUSES)[number];

export const IN_FLIGHT_DRAFTING_JOB_STATUSES: readonly DraftingJobStatus[] = ["pending", "running"];

export const DRAFTING_SOURCE_KINDS = ["text", "markdown", "url"] as const;
export type DraftingSourceKind = (typeof DRAFTING_SOURCE_KINDS)[number];

export type DraftingJob = {
  id: string;
  kind: DraftingJobKind;
  status: DraftingJobStatus;
  /** A rules job points to the policy job it continues, when the backend knows it. */
  parentJobId: string | null;
  sourceKind: DraftingSourceKind | null;
  sourceUrl: string | null;
  /** Null only for a URL job before the worker created the regulation. */
  regulationId: string | null;
  /** Policies drafted by a succeeded policy job. */
  policyIds: string[];
  /** Rules drafted by a succeeded rules job. */
  ruleIds: string[];
  errorMessage: string | null;
  warnings: string[];
  attempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type DraftingJobFilter = {
  statuses?: readonly DraftingJobStatus[];
  kinds?: readonly DraftingJobKind[];
  limit?: number;
};

export type DraftingJobPage = { items: DraftingJob[]; total: number };

export function isDraftingJobInFlight(job: DraftingJob): boolean {
  return IN_FLIGHT_DRAFTING_JOB_STATUSES.includes(job.status);
}

/** The policy job a wizard run is resumed from (`/wizard?jobId=`), or null for a rules job started outside it. */
export function findWizardRunJobId(job: DraftingJob): string | null {
  return job.kind === "policy_from_regulation" ? job.id : job.parentJobId;
}

export function wizardRunHref(jobId: string): string {
  return `/wizard?jobId=${encodeURIComponent(jobId)}`;
}
