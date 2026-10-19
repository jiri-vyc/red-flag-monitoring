import type { Policy, PolicyApproval, UpdatePolicyTextInput } from "../types";

export interface PoliciesService {
  loadPolicies(): Promise<Policy[]>;
  loadPolicy(policyId: string): Promise<Policy>;
  updatePolicyText(input: UpdatePolicyTextInput): Promise<Policy>;
  /** Approves the latest version. The live backend then drafts the policy's rules as a side effect. */
  approvePolicy(input: { policyId: string; approvedBy: string }): Promise<PolicyApproval>;
}
