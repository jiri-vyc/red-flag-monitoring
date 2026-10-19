import type { DraftingJob, DraftingJobKind, DraftingJobStatus } from "../../domain/draftingJob";
import type { Page, PageRequest } from "../pagination";
import type { PolicyDraft, RuleDraft } from "./draftGenerator";

export type NewDraftingJob = Pick<
  DraftingJob,
  | "kind"
  | "parentJobId"
  | "sourceKind"
  | "sourceUrl"
  | "scope"
  | "versionLabel"
  | "regulationId"
  | "regulationVersionId"
  | "policyVersionId"
  | "createdBy"
>;

// Null filters match everything.
export type DraftingJobFilter = {
  statuses: DraftingJobStatus[] | null;
  kinds: DraftingJobKind[] | null;
  regulationId: string | null;
  policyVersionId: string | null;
};

export type PolicyJobCompletion = {
  jobId: string;
  createdBy: string;
  drafts: PolicyDraft[];
  warnings: string[];
  finishedAt: Date;
};

export type RulesJobCompletion = {
  jobId: string;
  createdBy: string;
  policyId: string;
  policyVersionId: string;
  drafts: RuleDraft[];
  warnings: string[];
  finishedAt: Date;
};

export type DraftingJobFailure = { jobId: string; errorMessage: string; finishedAt: Date };

export interface DraftingJobRepository {
  createJob(job: NewDraftingJob): Promise<DraftingJob>;
  findJob(jobId: string): Promise<DraftingJob | null>;
  // Status filters match the status reported after the timeout (reportTimedOutJob), evaluated at `now`.
  listJobs(query: { filter: DraftingJobFilter; page: PageRequest; now: Date }): Promise<Page<DraftingJob>>;
  // The policy_from_regulation job that drafted any version of the policy.
  findPolicyJobIdForPolicy(policyId: string): Promise<string | null>;
  // pending → running. Null when the job is not pending, e.g. a repeated async invocation already claimed it.
  claimJob(jobId: string, startedAt: Date): Promise<DraftingJob | null>;
  attachRegulationVersion(input: {
    jobId: string;
    regulationId: string;
    regulationVersionId: string;
  }): Promise<void>;
  // The drafts and the job's success are written in one transaction.
  completePolicyJob(completion: PolicyJobCompletion): Promise<void>;
  completeRulesJob(completion: RulesJobCompletion): Promise<void>;
  markJobFailed(failure: DraftingJobFailure): Promise<void>;
}

export interface DraftingJobLauncher {
  launchJob(jobId: string): Promise<void>;
}

export type FetchedRegulationSource = { title: string | null; text: string };

export interface RegulationSourceFetcher {
  fetchSource(url: string): Promise<FetchedRegulationSource>;
}

export function newRulesFromPolicyJob(input: {
  policyVersionId: string;
  parentJobId: string | null;
  createdBy: string;
}): NewDraftingJob {
  return {
    kind: "rules_from_policy",
    parentJobId: input.parentJobId,
    sourceKind: null,
    sourceUrl: null,
    scope: null,
    versionLabel: null,
    regulationId: null,
    regulationVersionId: null,
    policyVersionId: input.policyVersionId,
    createdBy: input.createdBy,
  };
}
