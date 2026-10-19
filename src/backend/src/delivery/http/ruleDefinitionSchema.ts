import { z } from "zod";

import {
  COMPARISON_OPERATORS,
  CONDITION_LOGICS,
  listConditionNodes,
  type RuleCondition,
  type RuleConditionGroup,
  type RuleConditionNode,
  type RuleDefinition,
} from "../../domain/ruleDefinition";
import { requiredText, uniqueBy } from "./schemas";

const conditionOperandSchema = z.union([
  z.strictObject({ feature: requiredText }),
  z.strictObject({ expr: requiredText }),
  z.strictObject({ list: requiredText }),
  z.strictObject({ value: z.union([z.number(), z.string(), z.boolean()]) }),
]);

const ruleConditionSchema = z.object({
  id: requiredText,
  label: requiredText,
  left: conditionOperandSchema,
  op: z.enum(COMPARISON_OPERATORS),
  right: conditionOperandSchema,
}) satisfies z.ZodType<RuleCondition>;

const ruleConditionGroupSchema: z.ZodType<RuleConditionGroup> = z.object({
  id: requiredText,
  label: requiredText,
  match: z.enum(CONDITION_LOGICS),
  get conditions() {
    return z.array(ruleConditionNodeSchema).min(1);
  },
});

const ruleConditionNodeSchema: z.ZodType<RuleConditionNode> = z.union([
  ruleConditionSchema,
  ruleConditionGroupSchema,
]);

// Feature names and expressions are checked against the catalogue by findRuleLogicViolation in the domain.
export const ruleDefinitionSchema = z.object({
  match: z.enum(CONDITION_LOGICS),
  features: z.array(requiredText),
  conditions: z
    .array(ruleConditionNodeSchema)
    .min(1)
    .refine((conditions) => uniqueBy(listConditionNodes(conditions), (node) => node.id), {
      message: "Condition ids must be unique across nested groups",
    }),
}) satisfies z.ZodType<RuleDefinition>;
