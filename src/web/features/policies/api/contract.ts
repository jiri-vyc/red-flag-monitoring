import type { Policy, UpdatePolicyTextInput } from "../types";

export interface PoliciesService {
  loadPolicies(): Promise<Policy[]>;
  loadPolicy(policyId: string): Promise<Policy>;
  updatePolicyText(input: UpdatePolicyTextInput): Promise<Policy>;
  approvePolicy(input: { policyId: string; approvedBy: string }): Promise<Policy>;
}
