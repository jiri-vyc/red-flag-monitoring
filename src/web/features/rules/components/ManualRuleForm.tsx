"use client";

import { Bot, CodeXml, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldStyles } from "@/components/ui/Field";
import { LoadingRing } from "@/components/ui/LoadingRing";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, QueryView } from "@/components/ui/StateViews";
import { usePolicies } from "@/features/policies/api/hooks";
import type { Policy } from "@/features/policies/types";
import { useI18n } from "@/i18n/I18nProvider";

import { useCreateManualRule } from "../api/hooks";
import {
  validateManualRuleForm,
  type ManualRuleFormResult,
  type ManualRuleFormValues,
} from "../manualRuleForm";
import type { RuleType } from "../types";
import styles from "./ManualRuleForm.module.css";
import { RuleConfigFields } from "./RuleConfigFields";

const INITIAL_VALUES: ManualRuleFormValues = {
  description: "",
  policyId: "",
  type: "deterministic",
  sensitivity: 80,
  riskProfiles: ["high", "medium", "low", "unknown"],
};

type FormErrors = Extract<ManualRuleFormResult, { isValid: false }>["errors"];

function RuleTypeChoice({ value, onChange }: { value: RuleType; onChange: (type: RuleType) => void }) {
  const { t } = useI18n();
  const options = [
    { type: "deterministic" as const, Icon: CodeXml, hint: t.ruleForm.deterministicHint },
    { type: "agentic" as const, Icon: Bot, hint: t.ruleForm.agenticHint },
  ];
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

function ManualRuleFormFields({ policies }: { policies: Policy[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const createRuleMutation = useCreateManualRule();
  const [values, setValues] = useState<ManualRuleFormValues>(INITIAL_VALUES);
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
        <Field label={t.ruleForm.source} htmlFor="rule-policy" error={translateError("policyId")}>
          <select
            id="rule-policy"
            className={fieldStyles.select}
            value={values.policyId}
            onChange={(event) => updateValues({ policyId: event.target.value })}
          >
            <option value="">{t.ruleForm.selectPolicy}</option>
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.name} ({policy.sourceProvision})
              </option>
            ))}
          </select>
        </Field>
        <RuleTypeChoice value={values.type} onChange={(type) => updateValues({ type })} />
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
  return (
    <>
      <PageHeader
        backLink={{ href: "/rules", label: t.rules.title }}
        title={t.ruleForm.title}
        description={t.ruleForm.subtitle}
      />
      <QueryView query={policiesQuery}>
        {(policies) => <ManualRuleFormFields policies={policies} />}
      </QueryView>
    </>
  );
}
