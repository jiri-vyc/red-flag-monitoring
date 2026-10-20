"use client";

import { Timer } from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";

import {
  computeFauReportDeadlines,
  type DeadlineState,
  type FauReportDeadline,
} from "../domain/fauReportDeadlines";
import type { FauReport } from "../types";
import styles from "./FauReport.module.css";

const TICK_MS = 60_000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const STATE_TONES: Record<DeadlineState, BadgeTone> = {
  on_track: "success",
  approaching: "warning",
  overdue: "danger",
  met: "success",
  missed: "danger",
};

/** Deadlines are days long, so "2 d 5 h" (or "35 min" under an hour) is precise enough. */
function formatDaysAndHours(milliseconds: number): string {
  const absoluteMs = Math.abs(milliseconds);
  if (absoluteMs < HOUR_MS) {
    return `${Math.floor(absoluteMs / 60_000)} min`;
  }
  const days = Math.floor(absoluteMs / DAY_MS);
  const hours = Math.floor((absoluteMs % DAY_MS) / HOUR_MS);
  return days > 0 ? `${days} d ${hours} h` : `${hours} h`;
}

function DeadlineRow({ label, deadline }: { label: string; deadline: FauReportDeadline }) {
  const { t, locale } = useI18n();
  const labels = t.fauReports.deadlines;
  const duration = formatDaysAndHours(deadline.remainingMs);
  const isPending = deadline.state !== "met" && deadline.state !== "missed";
  return (
    <div className={styles.deadline}>
      <p className={styles.deadlineLabel}>{label}</p>
      <p className={styles.deadlineValue}>
        <Badge tone={STATE_TONES[deadline.state]}>{labels.state[deadline.state]}</Badge>
        <span>{formatMessage(labels.dueAt, { date: formatDateTime(deadline.dueAt, locale) })}</span>
        {isPending && (
          <strong>
            {deadline.remainingMs >= 0
              ? formatMessage(labels.remaining, { duration })
              : formatMessage(labels.overdueBy, { duration })}
          </strong>
        )}
      </p>
    </div>
  );
}

/** Issue #20: time since the alert and since the suspicion conclusion, against SVZ-03 and MP FAÚ č. 4 limits. */
export function FauReportDeadlinesCard({ report }: { report: FauReport }) {
  const { t } = useI18n();
  const labels = t.fauReports.deadlines;
  const submittedAt = report.submission?.submittedAt ?? null;
  const nowMs = useNow(TICK_MS, submittedAt === null);
  const deadlines = computeFauReportDeadlines({
    alertRaisedAt: report.alertRaisedAt,
    suspicionConcludedAt: report.createdAt,
    submittedAt,
    nowMs,
  });
  return (
    <Card
      title={
        <>
          <Timer aria-hidden="true" />
          {labels.title}
        </>
      }
    >
      <KeyValueList
        items={[
          { label: labels.sinceAlert, value: formatDaysAndHours(deadlines.elapsedSinceAlertMs) },
          { label: labels.sinceConclusion, value: formatDaysAndHours(deadlines.elapsedSinceConclusionMs) },
        ]}
      />
      <DeadlineRow label={labels.internal} deadline={deadlines.internal} />
      <DeadlineRow label={labels.maximum} deadline={deadlines.maximum} />
      <p className={styles.hint}>{labels.hint}</p>
    </Card>
  );
}
