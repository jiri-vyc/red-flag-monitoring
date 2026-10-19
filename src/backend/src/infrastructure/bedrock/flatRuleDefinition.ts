import { z } from "zod";

import {
  COMPARISON_OPERATORS,
  CONDITION_LOGICS,
  type ConditionOperand,
  type RuleConditionNode,
  type RuleDefinition,
} from "../../domain/ruleDefinition";

// The model writes rule definitions flat: groups and conditions point at their parent group, "root" being the
// definition itself, and every operand is {kind, value} with the value as text. Bedrock structured outputs allow
// at most 16 union-typed parameters per schema; the nested tree with its operand union needed more.
export const ROOT_GROUP_ID = "root";

const OPERAND_KINDS = ["feature", "expr", "list", "number", "text", "boolean"] as const;

const flatOperandSchema = z.strictObject({ kind: z.enum(OPERAND_KINDS), value: z.string() });

export const flatRuleDefinitionSchema = z.strictObject({
  match: z.enum(CONDITION_LOGICS),
  features: z.array(z.string()),
  groups: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      parentGroupId: z.string(),
      match: z.enum(CONDITION_LOGICS),
    }),
  ),
  conditions: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      parentGroupId: z.string(),
      left: flatOperandSchema,
      op: z.enum(COMPARISON_OPERATORS),
      right: flatOperandSchema,
    }),
  ),
});

export type FlatRuleDefinition = z.infer<typeof flatRuleDefinitionSchema>;
type FlatOperand = z.infer<typeof flatOperandSchema>;

export type RuleDefinitionBuildResult = { definition: RuleDefinition } | { violation: string };

export function buildRuleDefinition(flat: FlatRuleDefinition): RuleDefinitionBuildResult {
  const structureViolation = findStructureViolation(flat);

  if (structureViolation) {
    return { violation: structureViolation };
  }

  try {
    return {
      definition: {
        match: flat.match,
        features: flat.features,
        conditions: buildChildren(flat, ROOT_GROUP_ID),
      },
    };
  } catch (error) {
    if (error instanceof InvalidOperandError) {
      return { violation: error.message };
    }

    throw error;
  }
}

function findStructureViolation(flat: FlatRuleDefinition): string | null {
  const ids = [...flat.groups, ...flat.conditions].map(({ id }) => id);
  const duplicateId = ids.find((id, index) => ids.indexOf(id) !== index);

  if (duplicateId !== undefined) {
    return `Node id ${duplicateId} is used twice`;
  }

  const groupIds = new Set(flat.groups.map(({ id }) => id));
  const orphan = [...flat.groups, ...flat.conditions].find(
    ({ parentGroupId }) => parentGroupId !== ROOT_GROUP_ID && !groupIds.has(parentGroupId),
  );

  if (orphan) {
    return `Node ${orphan.id} points at an unknown group ${orphan.parentGroupId}`;
  }

  const unreachableGroup = flat.groups.find((group) => !isReachableFromRoot(group.id, flat));

  if (unreachableGroup) {
    return `Group ${unreachableGroup.id} is part of a cycle`;
  }

  const emptyGroup = flat.groups.find(
    ({ id }) => ![...flat.groups, ...flat.conditions].some(({ parentGroupId }) => parentGroupId === id),
  );

  return emptyGroup ? `Group ${emptyGroup.id} has no conditions` : null;
}

function isReachableFromRoot(groupId: string, flat: FlatRuleDefinition): boolean {
  const parentById = new Map(flat.groups.map(({ id, parentGroupId }) => [id, parentGroupId]));
  let currentId = groupId;

  // A chain longer than the number of groups must revisit a group, i.e. it is a cycle.
  for (let step = 0; step <= flat.groups.length; step++) {
    const parentId = parentById.get(currentId);

    if (parentId === ROOT_GROUP_ID) {
      return true;
    }

    if (parentId === undefined) {
      return false;
    }

    currentId = parentId;
  }

  return false;
}

function buildChildren(flat: FlatRuleDefinition, parentGroupId: string): RuleConditionNode[] {
  const groups = flat.groups
    .filter((group) => group.parentGroupId === parentGroupId)
    .map(({ id, label, match }) => ({ id, label, match, conditions: buildChildren(flat, id) }));
  const conditions = flat.conditions
    .filter((condition) => condition.parentGroupId === parentGroupId)
    .map(({ id, label, left, op, right }) => ({
      id,
      label,
      left: buildOperand(id, left),
      op,
      right: buildOperand(id, right),
    }));

  return [...conditions, ...groups];
}

class InvalidOperandError extends Error {}

function buildOperand(conditionId: string, operand: FlatOperand): ConditionOperand {
  switch (operand.kind) {
    case "feature":
      return { feature: operand.value };
    case "expr":
      return { expr: operand.value };
    case "list":
      return { list: operand.value };
    case "text":
      return { value: operand.value };
    case "number":
      return { value: parseNumber(conditionId, operand.value) };
    case "boolean":
      return { value: parseBoolean(conditionId, operand.value) };
  }
}

function parseNumber(conditionId: string, text: string): number {
  const number = Number(text.trim().replace(",", "."));

  if (text.trim() === "" || !Number.isFinite(number)) {
    throw new InvalidOperandError(`Condition ${conditionId}: "${text}" is not a number`);
  }

  return number;
}

function parseBoolean(conditionId: string, text: string): boolean {
  if (text === "true" || text === "false") {
    return text === "true";
  }

  throw new InvalidOperandError(`Condition ${conditionId}: "${text}" is not true or false`);
}
