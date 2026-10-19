import { z } from "zod";

import {
  COMPARISON_OPERATORS,
  CONDITION_LOGICS,
  type RuleCondition,
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

export const ruleDefinitionSchema = z.object({
  match: z.enum(CONDITION_LOGICS),
  features: z.array(requiredText),
  conditions: z
    .array(ruleConditionSchema)
    .min(1)
    .refine((conditions) => uniqueBy(conditions, (condition) => condition.id), {
      message: "Condition ids must be unique",
    }),
}) satisfies z.ZodType<RuleDefinition>;
