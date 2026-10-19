import { findFeatureDefinition } from "./features/featureCatalog";
import {
  isConditionGroup,
  listConditionNodes,
  listReferencedFeatures,
  parseScaledFeature,
  type RuleCondition,
  type RuleDefinition,
} from "./ruleDefinition";

const LIST_OPERATORS = new Set(["in", "not_in"]);

// Checks a definition against the feature catalogue; returns the first problem or null.
export function findRuleDefinitionViolation(definition: RuleDefinition): string | null {
  const unknownFeature = definition.features.find((featureId) => findFeatureDefinition(featureId) === null);

  if (unknownFeature) {
    return `Feature ${unknownFeature} is not in the feature catalogue`;
  }

  const unlistedFeature = listReferencedFeatures(definition).find(
    (featureId) => !definition.features.includes(featureId),
  );

  if (unlistedFeature) {
    return `Condition uses feature ${unlistedFeature}, which is missing from definition.features`;
  }

  const conditions = listConditionNodes(definition.conditions).filter(
    (node): node is RuleCondition => !isConditionGroup(node),
  );

  for (const condition of conditions) {
    const violation = findConditionViolation(condition);

    if (violation) {
      return violation;
    }
  }

  return null;
}

function findConditionViolation(condition: RuleCondition): string | null {
  const invalidExpression = [condition.left, condition.right].find(
    (operand) => "expr" in operand && parseScaledFeature(operand.expr) === null,
  );

  if (invalidExpression && "expr" in invalidExpression) {
    return `Condition ${condition.id}: expression "${invalidExpression.expr}" must have the form "<number> × <feature>"`;
  }

  if ("list" in condition.left) {
    return `Condition ${condition.id}: a reference list can only be the right operand`;
  }

  const isListOperator = LIST_OPERATORS.has(condition.op);
  const hasListOperand = "list" in condition.right;

  if (isListOperator !== hasListOperand) {
    return `Condition ${condition.id}: operators in and not_in need a reference list on the right, and only they`;
  }

  return null;
}
