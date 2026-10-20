"use client";

import { useState } from "react";

import { fieldStyles } from "@/components/ui/Field";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useI18n } from "@/i18n/I18nProvider";

import styles from "./PolicyTextField.module.css";

type PolicyTextMode = "edit" | "preview";

type PolicyTextFieldProps = {
  id: string;
  /** Owned by the parent, so unsaved edits survive switching to the preview and back. */
  value: string;
  onChange: (value: string) => void;
  textAreaClassName?: string;
};

/** Markdown text of a draft policy: a textarea with a formatted preview of the current (unsaved) text. */
export function PolicyTextField({ id, value, onChange, textAreaClassName }: PolicyTextFieldProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<PolicyTextMode>("edit");
  return (
    <div className={styles.field}>
      <div>
        <SegmentedControl
          label={t.policies.textView}
          options={[
            { value: "edit", label: t.common.edit },
            { value: "preview", label: t.policies.preview },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      {mode === "edit" ? (
        <>
          <label htmlFor={id} className="visually-hidden">
            {t.policies.text}
          </label>
          <textarea
            id={id}
            className={[fieldStyles.textarea, textAreaClassName].filter(Boolean).join(" ")}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={12}
          />
        </>
      ) : (
        <div className={styles.preview}>
          {value.trim() === "" ? (
            <p className={styles.empty}>{t.policies.emptyPreview}</p>
          ) : (
            <MarkdownText>{value}</MarkdownText>
          )}
        </div>
      )}
    </div>
  );
}
