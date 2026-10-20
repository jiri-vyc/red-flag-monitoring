import type {
  DeterministicTrace,
  EvaluatedCondition,
  EvaluatedConditionNode,
  RuleFeatures,
} from "../evaluation";
import { evaluateRuleDefinition, type ReferenceListItems } from "../ruleConditionEvaluation";
import { parseScaledFeature, type RuleDefinition } from "../ruleDefinition";

const RATIO_DECIMALS = 10_000;

export function measureDistanceToFiring(trace: DeterministicTrace, features: RuleFeatures): number {
  return combineDistances(
    trace.logic,
    trace.conditions.map((node) => measureNodeDistance(node, features)),
  );
}

export type ConditionMargin = { distance: number | null; observedValue: number | null };

export function measureConditionMargin(input: {
  definition: RuleDefinition;
  conditionId: string;
  features: RuleFeatures;
  referenceLists: ReferenceListItems;
}): ConditionMargin {
  const trace = evaluateRuleDefinition(input);
  const condition = findEvaluatedCondition(trace.conditions, input.conditionId);
  const distance = condition ? measureComparisonDistance(condition, input.features) : Infinity;
  const observedValue = condition?.left.value;

  return {
    distance: Number.isFinite(distance) ? distance : null,
    observedValue: typeof observedValue === "number" ? observedValue : null,
  };
}

function measureNodeDistance(node: EvaluatedConditionNode, features: RuleFeatures): number {
  if ("match" in node) {
    return combineDistances(
      node.match,
      node.conditions.map((child) => measureNodeDistance(child, features)),
    );
  }

  return measureComparisonDistance(node, features);
}

function combineDistances(match: "all" | "any", distances: number[]): number {
  return match === "all" ? Math.max(0, ...distances) : Math.min(...distances);
}

function measureComparisonDistance(condition: EvaluatedCondition, features: RuleFeatures): number {
  if (condition.result) {
    return 0;
  }

  const left = condition.left.value;

  if (typeof left !== "number" || !["<", "<=", ">", ">="].includes(condition.op)) {
    return Infinity;
  }

  if ("value" in condition.right && typeof condition.right.value === "number") {
    return relativeGap(condition.right.value, left);
  }

  if ("expr" in condition.right) {
    const scaledFeature = parseScaledFeature(condition.right.expr);
    const base = scaledFeature ? features[scaledFeature.feature] : null;

    return scaledFeature && typeof base === "number" && base !== 0
      ? relativeGap(scaledFeature.multiplier, left / base)
      : Infinity;
  }

  return Infinity;
}

function relativeGap(threshold: number, reachedValue: number): number {
  if (threshold === 0) {
    return Infinity;
  }

  return (
    Math.round((Math.abs(threshold - reachedValue) / Math.abs(threshold)) * RATIO_DECIMALS) / RATIO_DECIMALS
  );
}

function findEvaluatedCondition(
  nodes: EvaluatedConditionNode[],
  conditionId: string,
): EvaluatedCondition | null {
  for (const node of nodes) {
    if ("match" in node) {
      const found = findEvaluatedCondition(node.conditions, conditionId);

      if (found) {
        return found;
      }
    } else if (node.id === conditionId) {
      return node;
    }
  }

  return null;
}
