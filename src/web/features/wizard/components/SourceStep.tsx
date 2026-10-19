"use client";

import { FilePlus, FileUp, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldStyles } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { REGULATION_KINDS, type RegulationKind } from "@/features/regulations/api/dto";
import type { Regulation } from "@/features/regulations/types";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";

import type { WizardCapabilities } from "../api/contract";
import {
  areRegulationFieldsShown,
  buildDraftPoliciesInput,
  isSourceKindSupported,
  MARKDOWN_FILE_ACCEPT,
  SOURCE_KINDS,
  type SourceFormErrors,
  type SourceFormValues,
} from "../sourceForm";
import type { DraftPoliciesInput } from "../types";
import { DocumentMetadataSuggestion, useDocumentMetadataDetection } from "./DocumentMetadataSuggestion";
import styles from "./Wizard.module.css";

type SourceStepProps = {
  /** Set when the wizard adds a new wording to this regulation instead of creating one. */
  existingRegulation: Regulation | null;
  capabilities: WizardCapabilities;
  onSubmit: (input: DraftPoliciesInput) => void;
};

const DEFAULT_REGULATION_KIND: RegulationKind = "law";

function createInitialValues(versionLabel: string): SourceFormValues {
  return {
    kind: "file",
    file: null,
    url: "",
    text: "",
    code: "",
    title: "",
    regulationKind: DEFAULT_REGULATION_KIND,
    sourceUrl: "",
    versionLabel,
  };
}

/** Metadata the backend needs to create a regulation (POST /regulations). */
function NewRegulationFields({
  values,
  errors,
  onChange,
}: {
  values: SourceFormValues;
  errors: SourceFormErrors;
  onChange: (changes: Partial<SourceFormValues>) => void;
}) {
  const { t } = useI18n();
  const errorMessage = (field: keyof SourceFormErrors) => {
    const errorKey = errors[field];
    return errorKey ? t.wizard[errorKey] : null;
  };
  return (
    <>
      <Field label={t.wizard.regulationCode} htmlFor="wizard-regulation-code" error={errorMessage("code")}>
        <input
          id="wizard-regulation-code"
          className={fieldStyles.input}
          value={values.code}
          placeholder={t.wizard.regulationCodePlaceholder}
          onChange={(event) => onChange({ code: event.target.value })}
        />
      </Field>
      <Field label={t.wizard.regulationTitle} htmlFor="wizard-regulation-title" error={errorMessage("title")}>
        <input
          id="wizard-regulation-title"
          className={fieldStyles.input}
          value={values.title}
          placeholder={t.wizard.regulationTitlePlaceholder}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </Field>
      <Field label={t.wizard.regulationKind} htmlFor="wizard-regulation-kind">
        <select
          id="wizard-regulation-kind"
          className={fieldStyles.select}
          value={values.regulationKind}
          onChange={(event) => onChange({ regulationKind: event.target.value as RegulationKind })}
        >
          {REGULATION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t.wizard.regulationKindLabel[kind]}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={t.wizard.regulationSourceUrl}
        htmlFor="wizard-regulation-source-url"
        error={errorMessage("sourceUrl")}
      >
        <input
          id="wizard-regulation-source-url"
          type="url"
          className={fieldStyles.input}
          value={values.sourceUrl}
          placeholder="https://www.zakonyprolidi.cz/cs/2008-253"
          onChange={(event) => onChange({ sourceUrl: event.target.value })}
        />
      </Field>
    </>
  );
}

export function SourceStep({ existingRegulation, capabilities, onSubmit }: SourceStepProps) {
  const { t } = useI18n();
  const [defaultVersionLabel] = useState(() =>
    formatMessage(t.wizard.versionLabelDefault, { date: new Date().toISOString().slice(0, 10) }),
  );
  const [initialValues] = useState(() => createInitialValues(defaultVersionLabel));
  const [values, setValues] = useState<SourceFormValues>(initialValues);
  const metadataDetection = useDocumentMetadataDetection(values);
  /**
   * An existing regulation the user picked from a document's suggestion, like opening the wizard with
   * `?regulationId=`. It holds only for that document: another file or text, or another tab, drops it.
   */
  const [regulationChoice, setRegulationChoice] = useState<{
    detectionId: number;
    regulation: Regulation;
  } | null>(null);
  const suggestedRegulation =
    regulationChoice !== null && regulationChoice.detectionId === metadataDetection?.id
      ? regulationChoice.regulation
      : null;
  const targetRegulation = existingRegulation ?? suggestedRegulation;
  const [errors, setErrors] = useState<SourceFormErrors>({});
  const updateValues = (changes: Partial<SourceFormValues>) =>
    setValues((current) => ({ ...current, ...changes }));
  const sourceError = errors.source ? t.wizard[errors.source] : null;
  const isSourceSupported = isSourceKindSupported(values.kind, capabilities);
  const isRegulationFormShown = areRegulationFieldsShown(values.kind);

  const submitSource = () => {
    const result = buildDraftPoliciesInput(values, {
      existingRegulationId: targetRegulation?.id ?? null,
      capabilities,
      defaultVersionLabel,
    });
    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.input);
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
        {targetRegulation && (
          <Notice
            tone="info"
            title={t.wizard.newWordingTitle}
            actions={
              !existingRegulation && (
                <Button
                  variant="ghost"
                  icon={<FilePlus aria-hidden="true" />}
                  onClick={() => setRegulationChoice(null)}
                >
                  {t.wizard.createNewRegulationInstead}
                </Button>
              )
            }
          >
            {formatMessage(t.wizard.newWordingBody, {
              name: targetRegulation.name,
              code: targetRegulation.shortName,
            })}
          </Notice>
        )}
        <SegmentedControl
          label={t.wizard.sourceTitle}
          options={SOURCE_KINDS.map((kind) => ({ value: kind, label: t.wizard.sourceKind[kind] }))}
          value={values.kind}
          onChange={(kind) => {
            setErrors({});
            setRegulationChoice(null);
            updateValues({ kind });
          }}
        />
        {values.kind === "file" && (
          <Field
            label={t.wizard.fileLabel}
            htmlFor="wizard-file"
            hint={t.wizard.fileHint}
            error={sourceError}
          >
            <label className={styles.filePicker}>
              <FileUp aria-hidden="true" />
              <span>{values.file?.name ?? t.batches.chooseFile}</span>
              <input
                id="wizard-file"
                type="file"
                accept={MARKDOWN_FILE_ACCEPT}
                className="visually-hidden"
                onChange={(event) => updateValues({ file: event.target.files?.[0] ?? null })}
              />
            </label>
          </Field>
        )}
        {values.kind === "url" && (
          <>
            <Field label={t.wizard.urlLabel} htmlFor="wizard-url" hint={t.wizard.urlHint} error={sourceError}>
              <input
                id="wizard-url"
                type="url"
                className={fieldStyles.input}
                value={values.url}
                placeholder="https://eur-lex.europa.eu/eli/reg/2024/1624/oj"
                onChange={(event) => updateValues({ url: event.target.value })}
              />
            </Field>
            {!isSourceSupported && (
              <Notice tone="info" title={t.wizard.urlUnsupportedTitle}>
                {t.wizard.urlUnsupportedBody}
              </Notice>
            )}
          </>
        )}
        {values.kind === "text" && (
          <Field label={t.wizard.textLabel} htmlFor="wizard-text" error={sourceError}>
            <textarea
              id="wizard-text"
              className={fieldStyles.textarea}
              value={values.text}
              rows={10}
              onChange={(event) => updateValues({ text: event.target.value })}
            />
          </Field>
        )}
        {isRegulationFormShown && metadataDetection && (
          <DocumentMetadataSuggestion
            key={metadataDetection.id}
            detected={metadataDetection.detected}
            values={values}
            initialValues={initialValues}
            isNewRegulation={!targetRegulation}
            onChange={updateValues}
            onUseRegulation={(regulation) => {
              setErrors({});
              setRegulationChoice({ detectionId: metadataDetection.id, regulation });
            }}
          />
        )}
        {isRegulationFormShown && !targetRegulation && (
          <NewRegulationFields values={values} errors={errors} onChange={updateValues} />
        )}
        {isRegulationFormShown && (
          <Field
            label={t.wizard.versionLabel}
            htmlFor="wizard-version-label"
            hint={t.wizard.versionLabelHint}
            error={errors.versionLabel ? t.wizard[errors.versionLabel] : null}
          >
            <input
              id="wizard-version-label"
              className={fieldStyles.input}
              value={values.versionLabel}
              onChange={(event) => updateValues({ versionLabel: event.target.value })}
            />
          </Field>
        )}
        <div>
          <Button
            type="submit"
            size="lg"
            icon={<Sparkles aria-hidden="true" />}
            disabled={!isSourceSupported}
          >
            {t.wizard.generatePolicy}
          </Button>
        </div>
      </form>
    </Card>
  );
}
