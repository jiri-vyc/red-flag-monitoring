import type { Rule } from "@/features/rules/types";

import type { ApprovedPolicyDraft, DraftPoliciesInput, PolicyDraftResult } from "../types";

/** What the active implementation supports. The UI hides or disables what is false instead of letting it fail. */
export type WizardCapabilities = {
  /** The wizard and every link to it. */
  isAvailable: boolean;
  /**
   * Loading the regulation (text and metadata) from a URL. The URL tab stays visible either way; when false it
   * shows a notice and cannot be submitted. A Markdown file and pasted text are always supported.
   */
  canFetchUrl: boolean;
};

export interface WizardService {
  readonly capabilities: WizardCapabilities;
  /** Stores the regulation wording and drafts the internal policies that implement it (AI decision aids). */
  draftPolicies(input: DraftPoliciesInput): Promise<PolicyDraftResult>;
  /** Approves a policy draft and returns the rule drafts created for it. */
  approvePolicyDraft(policyId: string): Promise<ApprovedPolicyDraft>;
  /** Submits every rule of the policies that is still a draft for review. Returns all their rules. */
  finishRuleReview(policyIds: string[]): Promise<Rule[]>;
}
