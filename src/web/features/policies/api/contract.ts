import type { Policy, PolicyApproval, UpdatePolicyTextInput } from "../types";

/** What the active implementation supports. The UI hides actions that are false instead of letting them fail. */
export type PoliciesCapabilities = {
  /** Delete a policy never approved and with no rules derived from it (see findPolicyDeletionBlocker). */
  canDeletePolicy: boolean;
};

/** The actor is recorded in the audit trail of the deletion. */
export type DeletePolicyInput = { policyId: string; deletedBy: string };

/** A human review decision (AML): the required reason is stored as the version's review comment in the audit trail. */
export type RejectPolicyInput = { policyId: string; rejectedBy: string; reason: string };

export interface PoliciesService {
  readonly capabilities: PoliciesCapabilities;
  loadPolicies(): Promise<Policy[]>;
  loadPolicy(policyId: string): Promise<Policy>;
  /** Name by policy id, for links. Much cheaper than `loadPolicies` (no versions, no relations). */
  loadPolicyNames(): Promise<Record<string, string>>;
  updatePolicyText(input: UpdatePolicyTextInput): Promise<Policy>;
  /** Approves the latest version and starts drafting the policy's rules. */
  approvePolicy(input: { policyId: string; approvedBy: string }): Promise<PolicyApproval>;
  /** Rejects the latest version; an older approved version stays in force and the author can write a new one. */
  rejectPolicy(input: RejectPolicyInput): Promise<Policy>;
  /** Removes the policy with its versions; refused once a version was approved or rules derive from it. */
  deletePolicy(input: DeletePolicyInput): Promise<void>;
}
