"use client";

import { Field, fieldStyles } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useI18n } from "@/i18n/I18nProvider";

import type { RuleConfigFormErrors, RuleConfigFormValues } from "../manualRuleForm";
import { RISK_PROFILES, type RiskProfile } from "../types";
import styles from "./RuleConfig.module.css";

type RuleConfigFieldsProps = {
  idPrefix: string;
  values: RuleConfigFormValues;
  errors: RuleConfigFormErrors;
  onChange: (changes: Partial<RuleConfigFormValues>) => void;
};

function toggleRiskProfile(riskProfiles: RiskProfile[], riskProfile: RiskProfile): RiskProfile[] {
  return riskProfiles.includes(riskProfile)
    ? riskProfiles.filter((candidate) => candidate !== riskProfile)
    : [...riskProfiles, riskProfile];
}

/** Sensitivity and risk profile inputs, shared by rule creation and new-version forms. */
export function RuleConfigFields({ idPrefix, values, errors, onChange }: RuleConfigFieldsProps) {
  const { t } = useI18n();
  const riskProfilesError = errors.riskProfiles ? t.ruleForm[errors.riskProfiles] : null;

  return (
    <>
      <Notice tone="compliance">{t.compliance.suppressionWarning}</Notice>
      <Field
        label={`${t.ruleForm.sensitivity}: ${values.sensitivity}`}
        htmlFor={`${idPrefix}-sensitivity`}
        hint={t.ruleForm.sensitivityHint}
      >
        <input
          id={`${idPrefix}-sensitivity`}
          type="range"
          min={0}
          max={100}
          step={1}
          className={fieldStyles.range}
          value={values.sensitivity}
          onChange={(event) => onChange({ sensitivity: Number(event.target.value) })}
        />
      </Field>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t.ruleForm.riskProfiles}</legend>
        <div className={fieldStyles.checkboxGroup}>
          {RISK_PROFILES.map((riskProfile) => (
            <label key={riskProfile} className={fieldStyles.checkboxOption}>
              <input
                type="checkbox"
                checked={values.riskProfiles.includes(riskProfile)}
                onChange={() =>
                  onChange({ riskProfiles: toggleRiskProfile(values.riskProfiles, riskProfile) })
                }
              />
              {t.riskProfile[riskProfile]}
            </label>
          ))}
        </div>
        {riskProfilesError && (
          <p className={fieldStyles.error} role="alert">
            {riskProfilesError}
          </p>
        )}
      </fieldset>
    </>
  );
}
