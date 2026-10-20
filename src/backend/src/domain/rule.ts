import { AML_RISK_SCORES, type AmlRiskScore } from "./client";
import type { RuleLegalBasis } from "./regulation";
import type { RuleDefinition } from "./ruleDefinition";
import { findRuleDefinitionViolation } from "./ruleDefinitionValidation";
import { USER_ROLES, type UserRole } from "./user";
import type { ReviewableVersion } from "./versionStatus";

export const RULE_KINDS = ["deterministic", "agentic"] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

// M15: risk profiles are the client AML risk scores from the dataset.
export const RISK_PROFILES = AML_RISK_SCORES;
export type RiskProfile = AmlRiskScore;

export const DEFAULT_SENSITIVITY = 100;

// Issue #6 (E1, E2): a hit of the rule goes to the users holding this role; the contact person by default.
export const ESCALATION_ROLES = USER_ROLES;
export type EscalationRole = UserRole;
export const DEFAULT_ESCALATION_ROLE: EscalationRole = "contact_person";

// Issue #13: how hits of the rule are grouped into AML events. `transaction` gives one event per hit
// transaction (rule B), `client_month` one event per client and calendar month (rules A and C).
export const ALERT_GRANULARITIES = ["transaction", "client_month"] as const;
export type AlertGranularity = (typeof ALERT_GRANULARITIES)[number];
export const DEFAULT_ALERT_GRANULARITY: AlertGranularity = "transaction";

export type Rule = {
  id: string;
  policyId: string | null;
  code: string;
  alertType: string;
  alertGranularity: AlertGranularity;
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
// The escalation role is on the version too (E1); unlike the rest, a review may still change it.
export type RuleVersion = ReviewableVersion &
  RuleLogic & {
    ruleId: string;
    escalationRole: EscalationRole;
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

  return findRuleDefinitionViolation(logic.definition);
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
