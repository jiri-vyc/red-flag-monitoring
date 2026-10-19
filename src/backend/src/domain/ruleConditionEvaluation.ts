import type {
  DeterministicTrace,
  EvaluatedCondition,
  EvaluatedConditionGroup,
  EvaluatedConditionNode,
  EvaluatedOperand,
  OperandValue,
  RuleFeatures,
} from "./evaluation";
import {
  type ConditionLogic,
  type ConditionOperand,
  isConditionGroup,
  parseScaledFeature,
  type RuleCondition,
  type RuleConditionNode,
  type RuleDefinition,
} from "./ruleDefinition";

// Reference list code → items of the version fixed for the run (V5).
export type ReferenceListItems = ReadonlyMap<string, readonly string[]>;

export class RuleDefinitionEvaluationError extends Error {}

const AMOUNT_DECIMALS = 100;

// Evaluates all conditions without short-circuiting, so the trace shows every condition (spec "Trace").
// A comparison with a null operand is false (F6). Throws RuleDefinitionEvaluationError for a missing
// feature value, an unknown list or an invalid expression; the evaluation records that as `error`.
export function evaluateRuleDefinition(input: {
  definition: RuleDefinition;
  features: RuleFeatures;
  referenceLists: ReferenceListItems;
}): DeterministicTrace {
  const conditions = input.definition.conditions.map((node) => evaluateNode({ ...input, node }));
  const isMatched = combineResults(input.definition.match, conditions);

  return {
    logic: input.definition.match,
    conditions,
    matched: isMatched,
    summary: summarizeTrace(isMatched, conditions),
  };
}

type EvaluationInput = { features: RuleFeatures; referenceLists: ReferenceListItems };

function evaluateNode(input: EvaluationInput & { node: RuleConditionNode }): EvaluatedConditionNode {
  if (!isConditionGroup(input.node)) {
    return evaluateCondition({ ...input, condition: input.node });
  }

  const conditions = input.node.conditions.map((node) => evaluateNode({ ...input, node }));
  const group: EvaluatedConditionGroup = {
    id: input.node.id,
    label: input.node.label,
    match: input.node.match,
    conditions,
    result: combineResults(input.node.match, conditions),
  };

  return group;
}

function evaluateCondition(input: EvaluationInput & { condition: RuleCondition }): EvaluatedCondition {
  const left = resolveOperand({ ...input, operand: input.condition.left });
  const right = resolveOperand({ ...input, operand: input.condition.right });

  return {
    id: input.condition.id,
    label: input.condition.label,
    left,
    op: input.condition.op,
    right,
    result: compareValues(left.value, input.condition.op, right.value),
  };
}

function resolveOperand(input: EvaluationInput & { operand: ConditionOperand }): EvaluatedOperand {
  const { operand } = input;

  if ("feature" in operand) {
    return { ...operand, value: getFeatureValue(input.features, operand.feature) };
  }

  if ("expr" in operand) {
    return { ...operand, value: calculateScaledFeature(input.features, operand.expr) };
  }

  if ("list" in operand) {
    return { ...operand, value: getListItems(input.referenceLists, operand.list) };
  }

  return { ...operand, value: operand.value };
}

function getFeatureValue(features: RuleFeatures, featureId: string): OperandValue {
  const value = features[featureId];

  if (value === undefined) {
    throw new RuleDefinitionEvaluationError(`Feature ${featureId} was not calculated`);
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    throw new RuleDefinitionEvaluationError(`Feature ${featureId} cannot be compared`);
  }

  return value;
}

function calculateScaledFeature(features: RuleFeatures, expression: string): number | null {
  const scaledFeature = parseScaledFeature(expression);

  if (!scaledFeature) {
    throw new RuleDefinitionEvaluationError(`Invalid expression "${expression}"`);
  }

  const featureValue = getFeatureValue(features, scaledFeature.feature);

  if (featureValue === null) {
    return null;
  }

  if (typeof featureValue !== "number") {
    throw new RuleDefinitionEvaluationError(`Expression "${expression}" needs a numeric feature`);
  }

  return Math.round(scaledFeature.multiplier * featureValue * AMOUNT_DECIMALS) / AMOUNT_DECIMALS;
}

function getListItems(referenceLists: ReferenceListItems, listCode: string): string[] {
  const items = referenceLists.get(listCode);

  if (!items) {
    throw new RuleDefinitionEvaluationError(`Reference list ${listCode} is not fixed for this run`);
  }

  return [...items];
}

function compareValues(left: OperandValue, op: RuleCondition["op"], right: OperandValue): boolean {
  if (left === null || right === null) {
    return false;
  }

  if (op === "in" || op === "not_in") {
    return compareWithList(left, op, right);
  }

  if (op === "=") {
    return left === right;
  }

  if (op === "!=") {
    return left !== right;
  }

  if (typeof left !== "number" || typeof right !== "number") {
    return false;
  }

  return compareNumbers(left, op, right);
}

function compareWithList(
  left: Exclude<OperandValue, null>,
  op: "in" | "not_in",
  right: Exclude<OperandValue, null>,
) {
  if (!Array.isArray(right) || Array.isArray(left)) {
    return false;
  }

  const isListed = right.includes(String(left));

  return op === "in" ? isListed : !isListed;
}

function compareNumbers(left: number, op: ">" | ">=" | "<" | "<=", right: number): boolean {
  switch (op) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
  }
}

function combineResults(match: ConditionLogic, nodes: EvaluatedConditionNode[]): boolean {
  return match === "all" ? nodes.every((node) => node.result) : nodes.some((node) => node.result);
}

function summarizeTrace(isMatched: boolean, conditions: EvaluatedConditionNode[]): string {
  if (!isMatched) {
    return "Podmínky pravidla nejsou splněny.";
  }

  const matchedLabels = conditions.filter((node) => node.result).map((node) => node.label);

  return `Splněno: ${matchedLabels.join("; ")}.`;
}
