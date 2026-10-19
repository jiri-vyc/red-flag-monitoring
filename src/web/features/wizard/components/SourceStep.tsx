"use client";

import { FileUp, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldStyles } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useI18n } from "@/i18n/I18nProvider";

import {
  buildRegulationSource,
  type SourceFormErrorKey,
  type SourceFormValues,
  type SourceKind,
} from "../sourceForm";
import type { GeneratePolicyInput } from "../types";
import styles from "./Wizard.module.css";

type SourceStepProps = {
  initialValues: Partial<SourceFormValues>;
  onSubmit: (input: GeneratePolicyInput) => void;
};

const SOURCE_KINDS: SourceKind[] = ["file", "url", "text"];

export function SourceStep({ initialValues, onSubmit }: SourceStepProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<SourceFormValues>({
    kind: "file",
    file: null,
    url: "",
    text: "",
    regulationName: "",
    ...initialValues,
  });
  const [errorKey, setErrorKey] = useState<SourceFormErrorKey | null>(null);
  const updateValues = (changes: Partial<SourceFormValues>) =>
    setValues((current) => ({ ...current, ...changes }));
  const errorMessage = errorKey ? t.wizard[errorKey] : null;

  const submitSource = () => {
    const sourceResult = buildRegulationSource(values);
    if (!sourceResult.isValid) {
      setErrorKey(sourceResult.errorKey);
      return;
    }
    setErrorKey(null);
    onSubmit({ source: sourceResult.source, regulationName: values.regulationName });
  };

  return (
    <Card title={t.wizard.sourceTitle}>
      <form
        className={styles.sourceForm}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submitSource();
        }}
      >
        <SegmentedControl
          label={t.wizard.sourceTitle}
          options={SOURCE_KINDS.map((kind) => ({ value: kind, label: t.wizard.sourceKind[kind] }))}
          value={values.kind}
          onChange={(kind) => {
            setErrorKey(null);
            updateValues({ kind });
          }}
        />
        {values.kind === "file" && (
          <Field
            label={t.wizard.fileLabel}
            htmlFor="wizard-file"
            hint={t.wizard.fileHint}
            error={errorMessage}
          >
            <label className={styles.filePicker}>
              <FileUp aria-hidden="true" />
              <span>{values.file?.name ?? t.batches.chooseFile}</span>
              <input
                id="wizard-file"
                type="file"
                accept=".pdf,.md,.markdown,application/pdf,text/markdown"
                className="visually-hidden"
                onChange={(event) => updateValues({ file: event.target.files?.[0] ?? null })}
              />
            </label>
          </Field>
        )}
        {values.kind === "url" && (
          <Field label={t.wizard.urlLabel} htmlFor="wizard-url" error={errorMessage}>
            <input
              id="wizard-url"
              type="url"
              className={fieldStyles.input}
              value={values.url}
              placeholder="https://eur-lex.europa.eu/eli/reg/2024/1624/oj"
              onChange={(event) => updateValues({ url: event.target.value })}
            />
          </Field>
        )}
        {values.kind === "text" && (
          <Field label={t.wizard.textLabel} htmlFor="wizard-text" error={errorMessage}>
            <textarea
              id="wizard-text"
              className={fieldStyles.textarea}
              value={values.text}
              rows={10}
              onChange={(event) => updateValues({ text: event.target.value })}
            />
          </Field>
        )}
        <Field label={t.wizard.regulationName} htmlFor="wizard-regulation-name">
          <input
            id="wizard-regulation-name"
            className={fieldStyles.input}
            value={values.regulationName}
            placeholder={t.wizard.regulationNamePlaceholder}
            onChange={(event) => updateValues({ regulationName: event.target.value })}
          />
        </Field>
        <div>
          <Button type="submit" size="lg" icon={<Sparkles aria-hidden="true" />}>
            {t.wizard.generatePolicy}
          </Button>
        </div>
      </form>
    </Card>
  );
}
