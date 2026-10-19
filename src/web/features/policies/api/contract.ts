import type { Policy, PolicyApproval, UpdatePolicyTextInput } from "../types";

export interface PoliciesService {
  loadPolicies(): Promise<Policy[]>;
  loadPolicy(policyId: string): Promise<Policy>;
  updatePolicyText(input: UpdatePolicyTextInput): Promise<Policy>;
  /** Approves the latest version and starts drafting the policy's rules. */
  approvePolicy(input: { policyId: string; approvedBy: string }): Promise<PolicyApproval>;
}
