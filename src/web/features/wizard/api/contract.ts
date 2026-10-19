import type { DraftingJob } from "@/features/draftingJobs/types";
import type { PolicyApproval } from "@/features/policies/types";
import type { Rule } from "@/features/rules/types";

import type { DraftPoliciesInput, PolicyDraftResult } from "../types";

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
  /** Stores the regulation source and starts the job that drafts the internal policies implementing it. */
  startPolicyDrafting(input: DraftPoliciesInput): Promise<DraftingJob>;
  /** The regulation and the policy drafts (AI decision aids) of a succeeded policy job. */
  loadPolicyDraft(policyJob: DraftingJob): Promise<PolicyDraftResult>;
  /** Approves a policy draft, which starts the job that drafts its rules. */
  approvePolicyDraft(policyId: string): Promise<PolicyApproval>;
  /** The newest rules job of each approved policy. A policy without one is left out. */
  findRulesJobs(policyIds: string[]): Promise<DraftingJob[]>;
  /** Every rule of the policies, drafted or already reviewed. */
  loadDraftedRules(policyIds: string[]): Promise<Rule[]>;
  /** Submits every rule of the policies that is still a draft for review. Returns all their rules. */
  finishRuleReview(policyIds: string[]): Promise<Rule[]>;
}
