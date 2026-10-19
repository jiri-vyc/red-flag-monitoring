import { z } from "zod";

import { riskProfileSchema, ruleTypeSchema, type CreateManualRuleInput, type RuleConfig } from "./types";

/** Error messages are dictionary keys under `ruleForm`, so the form can show them in the current language. */
export type ManualRuleFormErrorKey = "validationDescription" | "validationPolicy" | "validationRiskProfiles";

/** Config fields as edited in a form. */
export type RuleConfigFormValues = {
  sensitivity: number;
  riskProfiles: RuleConfig["riskProfiles"];
};

export type ManualRuleFormValues = RuleConfigFormValues & {
  description: string;
  policyId: string;
  type: CreateManualRuleInput["type"];
};

export function toRuleConfigFormValues(config: RuleConfig): RuleConfigFormValues {
  return {
    sensitivity: config.sensitivity,
    riskProfiles: config.riskProfiles,
  };
}

const ruleConfigFormSchema = z.object({
  sensitivity: z.number().int().min(0).max(100),
  riskProfiles: z.array(riskProfileSchema).min(1, "validationRiskProfiles"),
});

const manualRuleFormSchema = ruleConfigFormSchema.extend({
  description: z.string().trim().min(10, "validationDescription"),
  policyId: z.string().min(1, "validationPolicy"),
  type: ruleTypeSchema,
});

type FormErrors<Values> = Partial<Record<keyof Values, ManualRuleFormErrorKey>>;

type FormResult<Input, Values> =
  { isValid: true; input: Input } | { isValid: false; errors: FormErrors<Values> };

export type ManualRuleFormResult = FormResult<CreateManualRuleInput, ManualRuleFormValues>;
export type RuleConfigFormResult = FormResult<RuleConfig, RuleConfigFormValues>;
export type RuleConfigFormErrors = FormErrors<RuleConfigFormValues>;

const FIELD_BY_SCHEMA_KEY: Record<string, keyof ManualRuleFormValues> = {
  description: "description",
  policyId: "policyId",
  riskProfiles: "riskProfiles",
};

function isErrorKey(message: string): message is ManualRuleFormErrorKey {
  return message.startsWith("validation");
}

function collectErrors(issues: z.ZodError["issues"]): FormErrors<ManualRuleFormValues> {
  const errors: FormErrors<ManualRuleFormValues> = {};
  for (const issue of issues) {
    const fieldName = FIELD_BY_SCHEMA_KEY[String(issue.path[0])];
    if (fieldName && isErrorKey(issue.message)) {
      errors[fieldName] = issue.message;
    }
  }
  return errors;
}

export function validateManualRuleForm(values: ManualRuleFormValues): ManualRuleFormResult {
  const parseResult = manualRuleFormSchema.safeParse(values);
  if (parseResult.success) {
    return { isValid: true, input: parseResult.data };
  }
  return { isValid: false, errors: collectErrors(parseResult.error.issues) };
}

export function validateRuleConfigForm(values: RuleConfigFormValues): RuleConfigFormResult {
  const parseResult = ruleConfigFormSchema.safeParse({
    sensitivity: values.sensitivity,
    riskProfiles: values.riskProfiles,
  });
  if (parseResult.success) {
    return { isValid: true, input: parseResult.data };
  }
  const { riskProfiles } = collectErrors(parseResult.error.issues);
  return { isValid: false, errors: { riskProfiles } };
}
