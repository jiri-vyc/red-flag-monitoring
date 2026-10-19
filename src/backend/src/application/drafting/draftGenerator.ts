import type { InternalPolicy, InternalPolicyVersion } from "../../domain/internalPolicy";
import type { PolicyLegalBasis, Regulation, RegulationVersion } from "../../domain/regulation";
import type { RuleVersion } from "../../domain/rule";
import type { NewRule } from "../rules/ruleRepository";

export type PolicyDraft = {
  code: string;
  title: string;
  body: string;
  legalBases: PolicyLegalBasis[];
};

export type RuleDraft = Omit<NewRule, "policyId"> &
  Pick<
    RuleVersion,
    | "definition"
    | "agentPrompt"
    | "agentModelId"
    | "baseScore"
    | "humanText"
    | "thresholdRationale"
    | "sensitivity"
    | "riskProfiles"
    | "legalBases"
  >;

// Spec 7.2: drafts proposed by an LLM. A human reviews every one before it takes effect.
export interface DraftGenerator {
  // `scope` names the part of the regulation to draft from, e.g. a heading; null means the whole text.
  draftPolicies(
    regulation: Regulation,
    version: RegulationVersion,
    scope: string | null,
  ): Promise<PolicyDraft[]>;
  draftRules(policy: InternalPolicy, version: InternalPolicyVersion): Promise<RuleDraft[]>;
}
