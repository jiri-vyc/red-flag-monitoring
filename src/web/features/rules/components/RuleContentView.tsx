"use client";

import { Bot, CodeXml, FileText } from "lucide-react";

import { useI18n } from "@/i18n/I18nProvider";

import type { RuleContent } from "../types";
import styles from "./RuleContent.module.css";

/** Deterministic rules show code and the Czech explanation side by side; agentic rules show the rule text. */
export function RuleContentView({ content }: { content: RuleContent }) {
  const { t } = useI18n();
  if (content.type === "agentic") {
    return (
      <div className={styles.agentic}>
        <h3 className={styles.panelTitle}>
          <Bot aria-hidden="true" />
          {t.rules.ruleText}
        </h3>
        <p className={styles.ruleText}>{content.ruleText}</p>
      </div>
    );
  }
  return (
    <div className={styles.sideBySide}>
      <div className={styles.codePanel}>
        <h3 className={styles.panelTitle}>
          <CodeXml aria-hidden="true" />
          {t.rules.code}
        </h3>
        <pre className={styles.code}>
          <code>{content.code}</code>
        </pre>
      </div>
      <div className={styles.explanationPanel}>
        <h3 className={styles.panelTitle}>
          <FileText aria-hidden="true" />
          {t.rules.explanation}
        </h3>
        <p className={styles.explanation} lang="cs">
          {content.explanation}
        </p>
      </div>
    </div>
  );
}
