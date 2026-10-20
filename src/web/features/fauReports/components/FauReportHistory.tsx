"use client";

import { History } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

import type { FauReportHistoryEntry } from "../types";
import styles from "./FauReport.module.css";

/** Newest first. The backend timeline will come from audit_events (#5, entity_type = fau_report). */
export function FauReportHistory({ history }: { history: FauReportHistoryEntry[] }) {
  const { t, locale } = useI18n();
  const labels = t.fauReports.history;
  const entriesNewestFirst = [...history].reverse();
  return (
    <Card
      title={
        <>
          <History aria-hidden="true" />
          {labels.title}
        </>
      }
    >
      <ol className={styles.history}>
        {entriesNewestFirst.map((entry, index) => (
          // Two entries can share action and time (save and submit in one click), so the index keeps keys unique.
          <li key={`${index}-${entry.at}-${entry.action}`} className={styles.historyEntry}>
            <strong>{labels.action[entry.action]}</strong>
            <span className={styles.historyMeta}>
              {formatDateTime(entry.at, locale)} · {entry.actor.name}
            </span>
            {entry.reason !== null && (
              <span>
                {labels.reason}: {entry.reason}
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className={styles.hint}>{labels.hint}</p>
    </Card>
  );
}
