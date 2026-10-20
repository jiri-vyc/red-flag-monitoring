import { isPolicyRejected } from "@/features/policies/domain/policyRejection";
import type { Policy } from "@/features/policies/types";

import type { PolicyDraftResult } from "./types";

/** Drafts the user left checked that were neither approved in an earlier attempt nor rejected. */
export function findPoliciesToApprove(
  policies: Policy[],
  approvedPolicyIds: string[],
  skippedPolicyIds: string[],
): Policy[] {
  return policies.filter(
    (policy) =>
      !approvedPolicyIds.includes(policy.id) &&
      !skippedPolicyIds.includes(policy.id) &&
      !isPolicyRejected(policy),
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

/** Every draft was rejected and none approved, so the run has nothing to generate rules from. */
export function isEveryDraftRejected(policies: Policy[], approvedPolicyIds: string[]): boolean {
  return approvedPolicyIds.length === 0 && policies.length > 0 && policies.every(isPolicyRejected);
}

/** Skipped and rejected drafts are not approved, so the rules, review and done steps work only with the approved ones. */
export function keepApprovedPolicies(
  draft: PolicyDraftResult,
  approvedPolicyIds: string[],
): PolicyDraftResult {
  return { ...draft, policies: draft.policies.filter((policy) => approvedPolicyIds.includes(policy.id)) };
}
