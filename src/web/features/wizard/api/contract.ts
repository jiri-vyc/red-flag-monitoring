import type { Rule } from "@/features/rules/types";

import type { GeneratePolicyInput, PolicyDraftResult } from "../types";

/** What the active implementation supports. The UI hides the wizard and every link to it when it is unavailable. */
export type WizardCapabilities = {
  isAvailable: boolean;
};

export interface WizardService {
  readonly capabilities: WizardCapabilities;
  /** Sends the regulation source to the backend, which extracts obligations and drafts an internal policy. */
  generatePolicyDraft(input: GeneratePolicyInput): Promise<PolicyDraftResult>;
  /** Generates draft rules from the (possibly edited) policy. */
  generateRules(policyId: string): Promise<Rule[]>;
  /** Submits every generated rule that is still a draft for review. */
  finishRuleReview(policyId: string): Promise<Rule[]>;
}
