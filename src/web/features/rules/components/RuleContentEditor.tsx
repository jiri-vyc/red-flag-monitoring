"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Field, fieldStyles } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";

import type { RuleContent } from "../types";
import styles from "./RuleContent.module.css";

type RuleContentEditorProps = {
  idPrefix: string;
  initialContent: RuleContent;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (content: RuleContent) => void;
  onCancel: () => void;
  /** Extra fields saved together with the content (e.g. config and change note of a new version). */
  children?: ReactNode;
};

export function RuleContentEditor({
  idPrefix,
  initialContent,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  children,
}: RuleContentEditorProps) {
  const { t } = useI18n();
  const [content, setContent] = useState<RuleContent>(initialContent);

  return (
    <form
      className={styles.editor}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(content);
      }}
    >
      {content.type === "agentic" ? (
        <Field label={t.rules.ruleText} htmlFor={`${idPrefix}-text`}>
          <textarea
            id={`${idPrefix}-text`}
            className={fieldStyles.textarea}
            value={content.ruleText}
            onChange={(event) => setContent({ type: "agentic", ruleText: event.target.value })}
            required
          />
        </Field>
      ) : (
        <div className={styles.sideBySide}>
          <Field label={t.rules.code} htmlFor={`${idPrefix}-code`}>
            <textarea
              id={`${idPrefix}-code`}
              className={fieldStyles.codeTextarea}
              value={content.code}
              spellCheck={false}
              onChange={(event) => setContent({ ...content, code: event.target.value })}
              required
            />
          </Field>
          <Field label={t.rules.explanation} htmlFor={`${idPrefix}-explanation`}>
            <textarea
              id={`${idPrefix}-explanation`}
              className={fieldStyles.codeTextarea}
              value={content.explanation}
              lang="cs"
              onChange={(event) => setContent({ ...content, explanation: event.target.value })}
              required
            />
          </Field>
        </div>
      )}
      {children}
      <div className={styles.editorActions}>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t.common.saving : submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
