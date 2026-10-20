import type { Policy, PolicyVersionState } from "../types";

export type PolicyDeletionBlocker = "approved_version" | "derived_rules";

// A superseded version was approved before a newer one replaced it.
const EVER_APPROVED_VERSION_STATES: readonly PolicyVersionState[] = ["approved", "superseded"];

/**
 * Why a policy cannot be deleted, or null when it can: an approved policy may have been used to derive rules,
 * and a policy rules are derived from would leave them without their source.
 */
export function findPolicyDeletionBlocker(
  policy: Pick<Policy, "versions" | "ruleIds">,
): PolicyDeletionBlocker | null {
  if (policy.versions.some((version) => EVER_APPROVED_VERSION_STATES.includes(version.state))) {
    return "approved_version";
  }
  return policy.ruleIds.length > 0 ? "derived_rules" : null;
}
