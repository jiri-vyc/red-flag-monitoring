import type { DraftingJobsService } from "@/features/draftingJobs/api/contract";
import type { DraftingJob } from "@/features/draftingJobs/types";
import { isPolicyRejected } from "@/features/policies/domain/policyRejection";
import { ApiError, isApiError } from "@/lib/apiError";

import type { WizardService } from "./api/contract";
import type { PolicyDraftResult } from "./types";

export type WizardRun =
  | { step: "drafting"; policyJobId: string }
  /** The run's policy drafts (or their regulation) were deleted since, so nothing is left to continue. */
  | { step: "unavailable"; policyJobId: string }
  | {
      step: "policy";
      policyJobId: string;
      draft: PolicyDraftResult;
      approvedPolicyIds: string[];
      rulesJobIds: string[];
    }
  | { step: "rules"; policyJobId: string; draft: PolicyDraftResult; rulesJobIds: string[] };

type WizardRunServices = {
  wizard: Pick<WizardService, "loadPolicyDraft" | "findRulesJobs">;
  draftingJobs: Pick<DraftingJobsService, "loadJob">;
};

async function findPolicyJob(job: DraftingJob, draftingJobs: WizardRunServices["draftingJobs"]) {
  if (job.kind === "policy_from_regulation") {
    return job;
  }
  if (job.parentJobId === null) {
    throw new ApiError({
      kind: "validation",
      message: `Rules job ${job.id} was not started from a wizard run, so the wizard cannot continue it.`,
    });
  }
  return draftingJobs.loadJob(job.parentJobId);
}

async function loadPolicyDraftIfPresent(
  policyJob: DraftingJob,
  wizard: WizardRunServices["wizard"],
): Promise<PolicyDraftResult | null> {
  try {
    return await wizard.loadPolicyDraft(policyJob);
  } catch (error) {
    if (isApiError(error) && error.kind === "not_found") {
      return null;
    }
    throw error;
  }
}

export async function resumeWizardRun(jobId: string, services: WizardRunServices): Promise<WizardRun> {
  const policyJob = await findPolicyJob(await services.draftingJobs.loadJob(jobId), services.draftingJobs);
  if (policyJob.status !== "succeeded") {
    return { step: "drafting", policyJobId: policyJob.id };
  }
  // A never-approved draft policy, and then its uncited regulation, may be deleted after the job succeeded.
  if (policyJob.policyIds.length === 0) {
    return { step: "unavailable", policyJobId: policyJob.id };
  }
  const draft = await loadPolicyDraftIfPresent(policyJob, services.wizard);
  if (draft === null) {
    return { step: "unavailable", policyJobId: policyJob.id };
  }
  // A rejected latest version is never approved, even when an older approved version keeps the policy in force.
  const approvedPolicyIds = draft.policies
    .filter((policy) => policy.status === "approved" && !isPolicyRejected(policy))
    .map((policy) => policy.id);
  const rulesJobs =
    approvedPolicyIds.length > 0 ? await services.wizard.findRulesJobs(approvedPolicyIds) : [];
  const rulesJobIds = rulesJobs.map((rulesJob) => rulesJob.id);
  // A run with drafts the user skipped (left as drafts) cannot be told apart from one interrupted mid-approval,
  // so it reopens the policy step: the approved policies are read-only there and continuing without selecting
  // any remaining draft goes on to the rules of the approved ones. Rejected drafts are decided too; when every
  // draft is rejected the policy step shows that there is nothing to generate rules from.
  const isEveryPolicyDecided = draft.policies.every(
    (policy) => approvedPolicyIds.includes(policy.id) || isPolicyRejected(policy),
  );
  return approvedPolicyIds.length > 0 && isEveryPolicyDecided
    ? { step: "rules", policyJobId: policyJob.id, draft, rulesJobIds }
    : { step: "policy", policyJobId: policyJob.id, draft, approvedPolicyIds, rulesJobIds };
}
