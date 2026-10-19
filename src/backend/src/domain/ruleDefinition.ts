// Shape of rule_versions.definition (M14): only the rule logic, score and sensitivity are columns.
export const CONDITION_LOGICS = ["any", "all"] as const;
export type ConditionLogic = (typeof CONDITION_LOGICS)[number];

export const COMPARISON_OPERATORS = [">", ">=", "<", "<=", "=", "!=", "in", "not_in"] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

// `feature` names an entry of the feature catalogue in code (M10), `list` a reference list code.
export type ConditionOperand =
  { feature: string } | { expr: string } | { list: string } | { value: number | string | boolean };

export type RuleCondition = {
  id: string;
  label: string;
  left: ConditionOperand;
  op: ComparisonOperator;
  right: ConditionOperand;
};

export type RuleDefinition = {
  match: ConditionLogic;
  features: string[];
  conditions: RuleCondition[];
};
