"use client";

import { Bot, CodeXml, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldStyles } from "@/components/ui/Field";
import { LoadingRing } from "@/components/ui/LoadingRing";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { ErrorState, QueryView } from "@/components/ui/StateViews";
import { usePolicies } from "@/features/policies/api/hooks";
import type { Policy } from "@/features/policies/types";
import { useRegulations } from "@/features/regulations/api/hooks";
import type { Regulation } from "@/features/regulations/types";
import { useI18n } from "@/i18n/I18nProvider";

import type { RulesCapabilities } from "../api/contract";
import { useCreateManualRule, useRulesCapabilities } from "../api/hooks";
import {
  validateManualRuleForm,
  type ManualRuleFormResult,
  type ManualRuleFormValues,
} from "../manualRuleForm";
import type { RuleType } from "../types";
import { DEFAULT_ESCALATION_ROLE } from "@/features/users/types";
import { useRolePermissions } from "@/features/users/api/hooks";
import { RoleGateNotice } from "@/features/users/components/RoleGateNotice";
import { EMPTY_LEGAL_BASIS, LegalBasisFields } from "./LegalBasisFields";
import styles from "./ManualRuleForm.module.css";
import { RuleConfigFields } from "./RuleConfigFields";

const INITIAL_VALUES: Omit<ManualRuleFormValues, "type"> = {
  description: "",
  policyId: "",
  legalBases: [EMPTY_LEGAL_BASIS],
  sensitivity: 80,
  riskProfiles: ["high", "medium", "low", "unknown"],
  escalationRole: DEFAULT_ESCALATION_ROLE,
};

type FormErrors = Extract<ManualRuleFormResult, { isValid: false }>["errors"];

/** Rule types the active implementation can create, in the order they are offered. */
function findCreatableRuleTypes(capabilities: RulesCapabilities): RuleType[] {
  const creatableByType: Record<RuleType, boolean> = {
    deterministic: capabilities.canCreateDeterministicRule,
    agentic: capabilities.canCreateAgenticRule,
  };
  return (["deterministic", "agentic"] as const).filter((type) => creatableByType[type]);
}

type RuleTypeChoiceProps = {
  value: RuleType;
  creatableTypes: RuleType[];
  onChange: (type: RuleType) => void;
};

function RuleTypeChoice({ value, creatableTypes, onChange }: RuleTypeChoiceProps) {
  const { t } = useI18n();
  const options = [
    { type: "deterministic" as const, Icon: CodeXml, hint: t.ruleForm.deterministicHint },
    { type: "agentic" as const, Icon: Bot, hint: t.ruleForm.agenticHint },
  ].filter(({ type }) => creatableTypes.includes(type));
  return (
    <fieldset className={styles.typeChoice}>
      <legend className={styles.legend}>{t.ruleForm.ruleType}</legend>
      {options.map(({ type, Icon, hint }) => (
        <label
          key={type}
          className={`${styles.typeOption} ${value === type ? styles.typeOptionSelected : ""}`}
        >
          <input type="radio" name="rule-type" checked={value === type} onChange={() => onChange(type)} />
          <Icon aria-hidden="true" />
          <span>
            <strong>{t.ruleType[type]}</strong>
            <small>{hint}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function ManualRuleFormFields({
  policies,
  regulations,
  creatableTypes,
}: {
  policies: Policy[];
  regulations: Regulation[];
  creatableTypes: RuleType[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const createRuleMutation = useCreateManualRule();
  const [values, setValues] = useState<ManualRuleFormValues>(() => ({
    ...INITIAL_VALUES,
    type: creatableTypes[0] ?? "agentic",
  }));
  const [errors, setErrors] = useState<FormErrors>({});

  const updateValues = (changes: Partial<ManualRuleFormValues>) =>
    setValues((current) => ({ ...current, ...changes }));
  const translateError = (field: keyof ManualRuleFormValues) => {
    const errorKey = errors[field];
    return errorKey ? t.ruleForm[errorKey] : null;
  };

  const submitForm = () => {
    const validationResult = validateManualRuleForm(values);
    if (!validationResult.isValid) {
      setErrors(validationResult.errors);
      return;
    }
    setErrors({});
    createRuleMutation.mutate(validationResult.input, {
      onSuccess: (createdRule) => router.push(`/rules/${createdRule.id}`),
    });
  };

  if (createRuleMutation.isPending) {
    return <LoadingRing label={t.ruleForm.submitting} />;
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submitForm();
      }}
    >
      <Card>
        <Field
          label={t.ruleForm.description}
          htmlFor="rule-description"
          hint={t.ruleForm.descriptionHint}
          error={translateError("description")}
        >
          <textarea
            id="rule-description"
            className={fieldStyles.textarea}
            value={values.description}
            onChange={(event) => updateValues({ description: event.target.value })}
            aria-describedby="rule-description-hint"
          />
        </Field>
        <Field label={t.ruleForm.policy} htmlFor="rule-policy" hint={t.ruleForm.policyHint}>
          <select
            id="rule-policy"
            className={fieldStyles.select}
            value={values.policyId}
            onChange={(event) => updateValues({ policyId: event.target.value })}
            aria-describedby="rule-policy-hint"
          >
            <option value="">{t.ruleForm.noPolicy}</option>
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.name}
              </option>
            ))}
          </select>
        </Field>
        <LegalBasisFields
          idPrefix="rule"
          regulations={regulations}
          values={values.legalBases}
          error={translateError("legalBases")}
          onChange={(legalBases) => updateValues({ legalBases })}
        />
        <RuleTypeChoice
          value={values.type}
          creatableTypes={creatableTypes}
          onChange={(type) => updateValues({ type })}
        />
      </Card>

      <Card>
        <RuleConfigFields idPrefix="rule" values={values} errors={errors} onChange={updateValues} />
      </Card>

      {createRuleMutation.error && <ErrorState error={createRuleMutation.error} />}
      <div>
        <Button type="submit" size="lg" icon={<Sparkles aria-hidden="true" />}>
          {t.ruleForm.submit}
        </Button>
      </div>
    </form>
  );
}

export function ManualRuleForm() {
  const { t } = useI18n();
  const policiesQuery = usePolicies();
  const regulationsQuery = useRegulations();
  const creatableTypes = findCreatableRuleTypes(useRulesCapabilities());
  const { canManageRules } = useRolePermissions();
  return (
    <>
      <PageHeader
        backLink={{ href: "/rules", label: t.rules.title }}
        title={t.ruleForm.title}
        description={t.ruleForm.subtitle}
      />
      {!canManageRules ? (
        <RoleGateNotice permission="canManageRules" />
      ) : creatableTypes.length === 0 ? (
        <Notice tone="info">{t.ruleForm.unavailable}</Notice>
      ) : (
        <QueryView query={policiesQuery}>
          {(policies) => (
            <QueryView query={regulationsQuery}>
              {(regulations) => (
                <ManualRuleFormFields
                  policies={policies}
                  regulations={regulations}
                  creatableTypes={creatableTypes}
                />
              )}
            </QueryView>
          )}
        </QueryView>
      )}
    </>
  );
}
