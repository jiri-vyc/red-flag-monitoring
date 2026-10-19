"use client";

import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import tableStyles from "@/components/ui/DataTable.module.css";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState, QueryView } from "@/components/ui/StateViews";
import { formatMessage } from "@/i18n/dictionaries";
import type { Dictionary } from "@/i18n/en";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime, formatElapsedTime } from "@/lib/format";

import { useDraftingJobs } from "../api/hooks";
import {
  findWizardRunJobId,
  IN_FLIGHT_DRAFTING_JOB_STATUSES,
  wizardRunHref,
  type DraftingJob,
  type DraftingJobStatus,
} from "../types";
import { DraftingJobStatusBadge } from "./DraftingJobStatusBadge";
import styles from "./DraftingJobs.module.css";

const STATUS_FILTERS = ["all", "inFlight", "succeeded", "failed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUSES_BY_FILTER: Record<StatusFilter, readonly DraftingJobStatus[]> = {
  all: [],
  inFlight: IN_FLIGHT_DRAFTING_JOB_STATUSES,
  succeeded: ["succeeded"],
  failed: ["failed"],
};

const LIST_LIMIT = 20;

function describeOutcome(t: Dictionary, job: DraftingJob): string | null {
  if (job.status === "failed") {
    return job.errorMessage ?? t.draftingJobs.noErrorMessage;
  }
  if (job.status !== "succeeded") {
    return null;
  }
  return job.kind === "policy_from_regulation"
    ? formatMessage(t.draftingJobs.policyCount, { count: job.policyIds.length })
    : formatMessage(t.draftingJobs.ruleCount, { count: job.ruleIds.length });
}

function JobDetails({ job }: { job: DraftingJob }) {
  const { t } = useI18n();
  const outcome = describeOutcome(t, job);
  const source = job.sourceKind ? (job.sourceUrl ?? t.draftingJobs.source[job.sourceKind]) : null;
  const duration =
    job.startedAt && job.finishedAt
      ? formatMessage(t.draftingJobs.took, {
          time: formatElapsedTime(Date.parse(job.finishedAt) - Date.parse(job.startedAt)),
        })
      : null;
  return (
    <span className={tableStyles.primaryCell}>
      {outcome && <span className={job.status === "failed" ? styles.errorText : undefined}>{outcome}</span>}
      {job.warnings.length > 0 && (
        <span className={styles.warningText} title={job.warnings.join("\n")}>
          {formatMessage(t.draftingJobs.warningCount, { count: job.warnings.length })}
        </span>
      )}
      {[source, duration].filter(Boolean).map((detail) => (
        <span key={detail} className={`${tableStyles.secondaryText} ${styles.breakable}`}>
          {detail}
        </span>
      ))}
    </span>
  );
}

function DraftingJobsTable({ jobs }: { jobs: DraftingJob[] }) {
  const { t, locale } = useI18n();
  if (jobs.length === 0) {
    return <EmptyState message={t.draftingJobs.empty} />;
  }
  return (
    <div className={tableStyles.wrapper}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th scope="col">{t.draftingJobs.step}</th>
            <th scope="col">{t.common.status}</th>
            <th scope="col">{t.draftingJobs.createdAt}</th>
            <th scope="col">{t.draftingJobs.details}</th>
            <th scope="col">
              <span className="visually-hidden">{t.draftingJobs.resume}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const wizardRunJobId = findWizardRunJobId(job);
            return (
              <tr key={job.id}>
                <td>
                  <span className={tableStyles.primaryCell}>
                    {t.draftingJobs.kind[job.kind]}
                    <span className={`${tableStyles.secondaryText} ${tableStyles.mono}`}>{job.id}</span>
                  </span>
                </td>
                <td>
                  <DraftingJobStatusBadge status={job.status} />
                </td>
                <td>{formatDateTime(job.createdAt, locale)}</td>
                <td>
                  <JobDetails job={job} />
                </td>
                <td>
                  {wizardRunJobId && (
                    <Link href={wizardRunHref(wizardRunJobId)}>{t.draftingJobs.resume}</Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DraftingJobsPanel() {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const jobsQuery = useDraftingJobs({ statuses: STATUSES_BY_FILTER[statusFilter], limit: LIST_LIMIT });
  return (
    <Card
      title={t.draftingJobs.title}
      actions={
        <RefreshButton
          label={t.draftingJobs.refresh}
          isFetching={jobsQuery.isFetching}
          onRefresh={() => void jobsQuery.refetch()}
        />
      }
    >
      <p className={styles.muted}>{t.draftingJobs.hint}</p>
      <SegmentedControl
        label={t.draftingJobs.filterLabel}
        options={STATUS_FILTERS.map((filter) => ({ value: filter, label: t.draftingJobs.filter[filter] }))}
        value={statusFilter}
        onChange={setStatusFilter}
      />
      <QueryView query={jobsQuery}>{(page) => <DraftingJobsTable jobs={page.items} />}</QueryView>
    </Card>
  );
}
