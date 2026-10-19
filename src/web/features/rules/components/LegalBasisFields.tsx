"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { fieldStyles } from "@/components/ui/Field";
import type { Regulation } from "@/features/regulations/types";
import { useI18n } from "@/i18n/I18nProvider";

import type { LegalBasisFormValues } from "../manualRuleForm";
import styles from "./LegalBasisFields.module.css";

export const EMPTY_LEGAL_BASIS: LegalBasisFormValues = { regulationId: "", ref: "" };

type LegalBasisFieldsProps = {
  idPrefix: string;
  regulations: Regulation[];
  values: LegalBasisFormValues[];
  error: string | null;
  onChange: (legalBases: LegalBasisFormValues[]) => void;
};

/** M5: the legal basis of a rule version, one row per cited regulation provision. */
export function LegalBasisFields({ idPrefix, regulations, values, error, onChange }: LegalBasisFieldsProps) {
  const { t } = useI18n();
  const updateRow = (rowIndex: number, changes: Partial<LegalBasisFormValues>) =>
    onChange(values.map((row, index) => (index === rowIndex ? { ...row, ...changes } : row)));
  const removeRow = (rowIndex: number) => onChange(values.filter((_row, index) => index !== rowIndex));

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t.ruleForm.legalBases}</legend>
      <p className={fieldStyles.hint}>{t.ruleForm.legalBasesHint}</p>
      {values.map((row, rowIndex) => (
        <div key={rowIndex} className={styles.row}>
          <label className="visually-hidden" htmlFor={`${idPrefix}-legal-basis-${rowIndex}-regulation`}>
            {t.ruleForm.regulation}
          </label>
          <select
            id={`${idPrefix}-legal-basis-${rowIndex}-regulation`}
            className={fieldStyles.select}
            value={row.regulationId}
            onChange={(event) => updateRow(rowIndex, { regulationId: event.target.value })}
          >
            <option value="">{t.ruleForm.selectRegulation}</option>
            {regulations.map((regulation) => (
              <option key={regulation.id} value={regulation.id}>
                {regulation.shortName}
              </option>
            ))}
          </select>
          <label className="visually-hidden" htmlFor={`${idPrefix}-legal-basis-${rowIndex}-ref`}>
            {t.ruleForm.provisionRef}
          </label>
          <input
            id={`${idPrefix}-legal-basis-${rowIndex}-ref`}
            className={fieldStyles.input}
            value={row.ref}
            placeholder={t.ruleForm.provisionRefPlaceholder}
            onChange={(event) => updateRow(rowIndex, { ref: event.target.value })}
          />
          <Button
            variant="ghost"
            icon={<Trash2 aria-hidden="true" />}
            disabled={values.length === 1}
            onClick={() => removeRow(rowIndex)}
          >
            {t.ruleForm.removeLegalBasis}
          </Button>
        </div>
      ))}
      <div>
        <Button
          variant="secondary"
          icon={<Plus aria-hidden="true" />}
          onClick={() => onChange([...values, EMPTY_LEGAL_BASIS])}
        >
          {t.ruleForm.addLegalBasis}
        </Button>
      </div>
      {error && (
        <p className={fieldStyles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
