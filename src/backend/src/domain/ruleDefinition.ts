// Shape of rule_versions.definition (M14): only the rule logic, score and sensitivity are columns.
export const CONDITION_LOGICS = ["any", "all"] as const;
export type ConditionLogic = (typeof CONDITION_LOGICS)[number];

export const COMPARISON_OPERATORS = [">", ">=", "<", "<=", "=", "!=", "in", "not_in"] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

// `feature` names an entry of the feature catalogue in code (M10), `list` a reference list code and `expr`
// a scaled feature in the form "<number> × <feature>", see parseScaledFeature.
export type ConditionOperand =
  { feature: string } | { expr: string } | { list: string } | { value: number | string | boolean };

export type RuleCondition = {
  id: string;
  label: string;
  left: ConditionOperand;
  op: ComparisonOperator;
  right: ConditionOperand;
};

// A group nests conditions under its own `match`, e.g. `all` inside a top-level `any`.
export type RuleConditionGroup = {
  id: string;
  label: string;
  match: ConditionLogic;
  conditions: RuleConditionNode[];
};

export type RuleConditionNode = RuleCondition | RuleConditionGroup;

export type RuleDefinition = {
  match: ConditionLogic;
  features: string[];
  conditions: RuleConditionNode[];
};

export type ScaledFeature = { multiplier: number; feature: string };

const SCALED_FEATURE_PATTERN = /^\s*(\d+(?:[.,]\d+)?)\s*[×*]\s*([a-z][a-z0-9_]*)\s*$/;

export function isConditionGroup(node: RuleConditionNode): node is RuleConditionGroup {
  return "match" in node;
}

// The only expression the DSL supports is a feature times a constant, e.g. "2 × client_q2_max_tx_czk".
export function parseScaledFeature(expression: string): ScaledFeature | null {
  const match = SCALED_FEATURE_PATTERN.exec(expression);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return { multiplier: Number(match[1].replace(",", ".")), feature: match[2] };
}

export function listConditionNodes(nodes: RuleConditionNode[]): RuleConditionNode[] {
  return nodes.flatMap((node) =>
    isConditionGroup(node) ? [node, ...listConditionNodes(node.conditions)] : [node],
  );
}

// Feature ids a definition reads, from `feature` and `expr` operands of all nested conditions.
export function listReferencedFeatures(definition: RuleDefinition): string[] {
  const featureIds = listConditionNodes(definition.conditions)
    .filter((node): node is RuleCondition => !isConditionGroup(node))
    .flatMap((condition) => [condition.left, condition.right])
    .map(findOperandFeature)
    .filter((featureId): featureId is string => featureId !== null);

  return [...new Set(featureIds)];
}

function findOperandFeature(operand: ConditionOperand): string | null {
  if ("feature" in operand) {
    return operand.feature;
  }

  if ("expr" in operand) {
    return parseScaledFeature(operand.expr)?.feature ?? null;
  }

  return null;
}
