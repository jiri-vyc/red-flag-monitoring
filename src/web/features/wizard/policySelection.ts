import type { Policy } from "@/features/policies/types";

import type { PolicyDraftResult } from "./types";

/** Drafts the user left checked that were not approved in an earlier attempt. */
export function findPoliciesToApprove(
  policies: Policy[],
  approvedPolicyIds: string[],
  skippedPolicyIds: string[],
): Policy[] {
  return policies.filter(
    (policy) => !approvedPolicyIds.includes(policy.id) && !skippedPolicyIds.includes(policy.id),
  );
}

/** The run continues to rules once something is approved, either now or in an earlier attempt. */
export function canContinueToRules(
  policies: Policy[],
  approvedPolicyIds: string[],
  skippedPolicyIds: string[],
): boolean {
  return (
    approvedPolicyIds.length > 0 ||
    findPoliciesToApprove(policies, approvedPolicyIds, skippedPolicyIds).length > 0
  );
}

/** Skipped drafts stay drafts, so the rules, review and done steps work only with the approved policies. */
export function keepApprovedPolicies(
  draft: PolicyDraftResult,
  approvedPolicyIds: string[],
): PolicyDraftResult {
  return { ...draft, policies: draft.policies.filter((policy) => approvedPolicyIds.includes(policy.id)) };
}
