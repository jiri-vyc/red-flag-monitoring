"use client";

import { FilePlusCorner, RotateCcw, WandSparkles, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { useRegulations } from "@/features/regulations/api/hooks";
import type { Regulation } from "@/features/regulations/types";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";

import {
  detectRegulationMetadata,
  findMatchingRegulation,
  findOverwrittenFields,
  METADATA_FORM_FIELDS,
  pickMetadataValues,
  toMetadataFormChanges,
  type DetectedRegulationMetadata,
  type MetadataFormChanges,
  type MetadataFormField,
} from "../regulationMetadata";
import type { SourceFormValues } from "../sourceForm";

// Pasted text is scanned once typing pauses; a file right after it is chosen.
const TEXT_DETECTION_DELAY_MS = 500;
// The metadata sits in the first lines, so a large regulation file is not read whole.
const FILE_HEADER_BYTES = 64 * 1024;

type DocumentSource = File | string;

/** `id` changes with every new file or text, so a suggestion shown for an older source starts over. */
export type DocumentMetadataDetection = {
  id: number;
  source: DocumentSource;
  detected: DetectedRegulationMetadata;
};

/** Detects the regulation metadata of the chosen file or the pasted text. A URL source has none. */
export function useDocumentMetadataDetection(
  values: Pick<SourceFormValues, "kind" | "file" | "text">,
): DocumentMetadataDetection | null {
  const { kind, file, text } = values;
  const [detection, setDetection] = useState<DocumentMetadataDetection | null>(null);

  const applyDetection = useCallback(
    (source: DocumentSource, documentText: string) =>
      setDetection((current) =>
        current?.source === source
          ? current
          : { id: (current?.id ?? 0) + 1, source, detected: detectRegulationMetadata(documentText) },
      ),
    [],
  );

  useEffect(() => {
    if (kind !== "file" || !file) {
      return;
    }
    let isCancelled = false;
    file
      .slice(0, FILE_HEADER_BYTES)
      .text()
      .then(
        (fileHeader) => {
          if (!isCancelled) {
            applyDetection(file, fileHeader);
          }
        },
        // An unreadable file only means there is nothing to suggest; submitting reports the file itself.
        () => undefined,
      );
    return () => {
      isCancelled = true;
    };
  }, [kind, file, applyDetection]);

  useEffect(() => {
    if (kind !== "text") {
      return;
    }
    const timer = window.setTimeout(() => applyDetection(text, text), TEXT_DETECTION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [kind, text, applyDetection]);

  const currentSource = kind === "file" ? file : kind === "text" ? text : null;
  return detection !== null && detection.source === currentSource ? detection : null;
}

type MetadataValues = Pick<SourceFormValues, MetadataFormField>;

type DocumentMetadataSuggestionProps = {
  detected: DetectedRegulationMetadata;
  values: MetadataValues;
  /** The untouched form values; a field still holding one is not reported as overwritten. */
  initialValues: MetadataValues;
  /** False when the text becomes a new wording of an existing regulation; only the label applies then. */
  isNewRegulation: boolean;
  onChange: (changes: MetadataFormChanges) => void;
  onUseRegulation: (regulation: Regulation) => void;
};

/** Offers to fill the regulation fields from the document. Nothing changes until the user clicks. */
export function DocumentMetadataSuggestion({
  detected,
  values,
  initialValues,
  isNewRegulation,
  onChange,
  onUseRegulation,
}: DocumentMetadataSuggestionProps) {
  const { t } = useI18n();
  const texts = t.wizard.documentMetadata;
  const regulationsQuery = useRegulations();
  const [isDismissed, setIsDismissed] = useState(false);
  /** The values before filling, set while the filled fields can be restored. */
  const [valuesBeforeFill, setValuesBeforeFill] = useState<MetadataFormChanges | null>(null);

  const changes = toMetadataFormChanges(detected, { isNewRegulation });
  const changedFields = METADATA_FORM_FIELDS.filter((field) => changes[field] !== undefined);
  const fieldNames = (fields: MetadataFormField[]) => fields.map((field) => texts.fields[field]).join(", ");

  if (valuesBeforeFill !== null) {
    const restoreValues = () => {
      onChange(valuesBeforeFill);
      setValuesBeforeFill(null);
    };
    return (
      <Notice
        tone="ai"
        title={texts.filledTitle}
        actions={
          <Button variant="ghost" icon={<RotateCcw aria-hidden="true" />} onClick={restoreValues}>
            {texts.undo}
          </Button>
        }
      >
        {formatMessage(texts.filledBody, {
          fields: fieldNames(Object.keys(valuesBeforeFill) as MetadataFormField[]),
        })}
      </Notice>
    );
  }
  if (isDismissed || changedFields.length === 0) {
    return null;
  }

  const matchingRegulation =
    isNewRegulation && regulationsQuery.data ? findMatchingRegulation(detected, regulationsQuery.data) : null;
  const overwrittenFields = findOverwrittenFields(values, changes, initialValues);
  const fillFields = () => {
    setValuesBeforeFill(pickMetadataValues(values, changes));
    onChange(changes);
  };
  const displayValue = (field: MetadataFormField) => {
    const value = changes[field] ?? "";
    return field === "regulationKind" && changes.regulationKind
      ? t.wizard.regulationKindLabel[changes.regulationKind]
      : value;
  };

  return (
    <Notice
      tone="ai"
      title={texts.title}
      actions={
        <>
          <Button variant="secondary" icon={<WandSparkles aria-hidden="true" />} onClick={fillFields}>
            {texts.fill}
          </Button>
          {matchingRegulation && (
            <Button
              variant="secondary"
              icon={<FilePlusCorner aria-hidden="true" />}
              onClick={() => onUseRegulation(matchingRegulation)}
            >
              {formatMessage(texts.useExisting, { code: matchingRegulation.shortName })}
            </Button>
          )}
          <Button variant="ghost" icon={<X aria-hidden="true" />} onClick={() => setIsDismissed(true)}>
            {texts.dismiss}
          </Button>
        </>
      }
    >
      {changedFields.map((field, index) => (
        <Fragment key={field}>
          {index > 0 && " · "}
          {texts.fields[field]}: <strong>{displayValue(field)}</strong>
        </Fragment>
      ))}
      {overwrittenFields.length > 0 && (
        <>
          <br />
          {formatMessage(texts.overwrites, { fields: fieldNames(overwrittenFields) })}
        </>
      )}
      {matchingRegulation && (
        <>
          <br />
          {formatMessage(texts.matchHint, {
            code: matchingRegulation.shortName,
            name: matchingRegulation.name,
          })}
        </>
      )}
    </Notice>
  );
}
