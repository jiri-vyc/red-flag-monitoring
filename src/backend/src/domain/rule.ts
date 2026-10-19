import { AML_RISK_SCORES, type AmlRiskScore } from "./client";
import type { RuleLegalBasis } from "./regulation";
import type { RuleDefinition } from "./ruleDefinition";
import type { ReviewableVersion } from "./versionStatus";

export const RULE_KINDS = ["deterministic", "agentic"] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

// M15: risk profiles are the client AML risk scores from the dataset.
export const RISK_PROFILES = AML_RISK_SCORES;
export type RiskProfile = AmlRiskScore;

export const DEFAULT_SENSITIVITY = 100;

export type Rule = {
  id: string;
  policyId: string | null;
  code: string;
  alertType: string;
  kind: RuleKind;
  isEnabled: boolean;
  activeVersionId: string | null;
  isWhitelistAllowed: boolean;
  createdAt: Date;
};

export type RuleLogic = {
  definition: RuleDefinition | null;
  agentPrompt: string | null;
  agentModelId: string | null;
  baseScore: number | null;
};

// M7: sensitivity, risk profiles and base score live on the version, changing them needs a new version.
export type RuleVersion = ReviewableVersion &
  RuleLogic & {
    ruleId: string;
    derivedFromPolicyVersionId: string | null;
    humanText: string;
    thresholdRationale: string | null;
    sensitivity: number;
    riskProfiles: RiskProfile[];
    legalBases: RuleLegalBasis[];
  };

// Deterministic rules score `base_score` from `definition`; agentic rules take the score from the LLM (M13).
export function findRuleLogicViolation(kind: RuleKind, logic: RuleLogic): string | null {
  if (kind === "deterministic") {
    return findDeterministicLogicViolation(logic);
  }

  return findAgenticLogicViolation(logic);
}

function findDeterministicLogicViolation(logic: RuleLogic): string | null {
  if (logic.definition === null || logic.baseScore === null) {
    return "A deterministic rule version needs a definition and a base score";
  }

  if (logic.agentPrompt !== null || logic.agentModelId !== null) {
    return "A deterministic rule version must not have an agent prompt or model";
  }

  return null;
}

function findAgenticLogicViolation(logic: RuleLogic): string | null {
  if (logic.agentPrompt === null || logic.agentModelId === null) {
    return "An agentic rule version needs an agent prompt and model";
  }

  if (logic.definition !== null || logic.baseScore !== null) {
    return "An agentic rule version must not have a definition or base score";
  }

  return null;
}

export function findActivationViolation(rule: Rule, version: RuleVersion): string | null {
  if (version.ruleId !== rule.id) {
    return "The version belongs to another rule";
  }

  if (version.status !== "approved") {
    return `Only an approved version can be activated, this one is ${version.status}`;
  }

  return null;
}

// M6: a rule without an active version has nothing to run.
export function canEnableRule(rule: Rule): boolean {
  return rule.activeVersionId !== null;
}

// M16: whitelist_allowed = false marks rules that are mandatory by regulation (rule B).
export function canWhitelistClients(rule: Rule): boolean {
  return rule.isWhitelistAllowed;
}
