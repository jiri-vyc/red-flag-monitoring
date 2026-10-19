import type { RuleKind } from "./rule";

// "calibration" marks values the regulation does not set; compliance must confirm them before approval.
export const RULE_PARAMETER_SOURCES = ["regulation", "calibration"] as const;
export type RuleParameterSource = (typeof RULE_PARAMETER_SOURCES)[number];

export type RuleParameter = {
  name: string;
  value: string;
  source: RuleParameterSource;
};

export type RegulationSource = {
  regulation: string;
  provisions: string;
};

// A machine-proposed rule draft derived from an internal policy. It is a decision aid for human review,
// never an approved rule.
export type RuleCandidate = {
  ruleId: string;
  title: string;
  definition: string;
  alertGranularity: string;
  kind: RuleKind;
  parameters: RuleParameter[];
  regulationSources: RegulationSource[];
  internalPolicySource: string;
  openQuestions: string[];
};
