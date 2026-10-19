"use client";

import { TriangleAlert } from "lucide-react";

import { useI18n } from "@/i18n/I18nProvider";

import type { DraftingJob } from "../types";
import styles from "./DraftingJobs.module.css";

export function DraftingJobWarnings({ jobs }: { jobs: DraftingJob[] }) {
  const { t } = useI18n();
  const warnings = jobs.flatMap((job) => job.warnings);
  if (warnings.length === 0) {
    return null;
  }
  return (
    <aside className={styles.warnings} role="status">
      <TriangleAlert className={styles.warningsIcon} aria-hidden="true" />
      <div className={styles.warningsBody}>
        <strong>{t.draftingJobs.warningsTitle}</strong>
        <ul>
          {warnings.map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
