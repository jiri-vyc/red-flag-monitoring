import { z } from "zod";

import { userRoleSchema } from "@/features/users/types";

import { riskProfileSchema, ruleTypeSchema, type CreateManualRuleInput, type RuleConfig } from "./types";

/** Error messages are dictionary keys under `ruleForm`, so the form can show them in the current language. */
export type ManualRuleFormErrorKey =
  "validationDescription" | "validationLegalBases" | "validationRiskProfiles";

/** Config fields as edited in a form. */
export type RuleConfigFormValues = {
  sensitivity: number;
  riskProfiles: RuleConfig["riskProfiles"];
  escalationRole: RuleConfig["escalationRole"];
};

/** One legal basis row of the form; an empty regulation id means none is selected yet. */
export type LegalBasisFormValues = { regulationId: string; ref: string };

export type ManualRuleFormValues = RuleConfigFormValues & {
  description: string;
  /** Empty when the rule stands without a policy (M4). */
  policyId: string;
  type: CreateManualRuleInput["type"];
  legalBases: LegalBasisFormValues[];
};

export function toRuleConfigFormValues(config: RuleConfig): RuleConfigFormValues {
  return {
    sensitivity: config.sensitivity,
    riskProfiles: config.riskProfiles,
    escalationRole: config.escalationRole,
  };
}

const ruleConfigFormSchema = z.object({
  sensitivity: z.number().int().min(0).max(100),
  riskProfiles: z.array(riskProfileSchema).min(1, "validationRiskProfiles"),
  escalationRole: userRoleSchema,
});

// M5: like the backend, a rule version needs 1..N legal bases, each with a regulation and a provision ref.
const legalBasisFormSchema = z.object({
  regulationId: z.string().min(1, "validationLegalBases"),
  ref: z.string().trim().min(1, "validationLegalBases"),
});

const manualRuleFormSchema = ruleConfigFormSchema.extend({
  description: z.string().trim().min(10, "validationDescription"),
  policyId: z.string().transform((policyId) => (policyId === "" ? null : policyId)),
  type: ruleTypeSchema,
  legalBases: z.array(legalBasisFormSchema).min(1, "validationLegalBases"),
});

type FormErrors<Values> = Partial<Record<keyof Values, ManualRuleFormErrorKey>>;

type FormResult<Input, Values> =
  { isValid: true; input: Input } | { isValid: false; errors: FormErrors<Values> };

export type ManualRuleFormResult = FormResult<CreateManualRuleInput, ManualRuleFormValues>;
export type RuleConfigFormResult = FormResult<RuleConfig, RuleConfigFormValues>;
export type RuleConfigFormErrors = FormErrors<RuleConfigFormValues>;

const FIELD_BY_SCHEMA_KEY: Record<string, keyof ManualRuleFormValues> = {
  description: "description",
  legalBases: "legalBases",
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
    escalationRole: values.escalationRole,
  });
  if (parseResult.success) {
    return { isValid: true, input: parseResult.data };
  }
  const { riskProfiles } = collectErrors(parseResult.error.issues);
  return { isValid: false, errors: { riskProfiles } };
}
