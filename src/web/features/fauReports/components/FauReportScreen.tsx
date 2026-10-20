"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, QueryView } from "@/components/ui/StateViews";
import { batchTransactionPath } from "@/features/batches/batchPaths";
import { useRolePermissions } from "@/features/users/api/hooks";
import { RoleGateNotice } from "@/features/users/components/RoleGateNotice";
import { useI18n } from "@/i18n/I18nProvider";
import { downloadTextFile } from "@/lib/downloadTextFile";

import { useFauReport, useFauReportsCapabilities } from "../api/hooks";
import { canEditFauReport } from "../domain/fauReportLifecycle";
import { buildFauReportMarkdown, fauReportMarkdownFileName } from "../domain/fauReportMarkdown";
import type { FauReport } from "../types";
import styles from "./FauReport.module.css";
import { FauReportDeadlinesCard } from "./FauReportDeadlinesCard";
import { FauReportHistory } from "./FauReportHistory";
import { FauReportSections } from "./FauReportSections";
import { FauReportStatusBadge } from "./FauReportStatusBadge";
import { FauReportWorkflowCard } from "./FauReportWorkflowCard";

function downloadReport(report: FauReport): void {
  downloadTextFile({
    content: buildFauReportMarkdown(report),
    fileName: fauReportMarkdownFileName(report),
    mimeType: "text/markdown;charset=utf-8",
  });
}

function FauReportDetail({ report }: { report: FauReport }) {
  const { t } = useI18n();
  const { canPrepareFauReport } = useRolePermissions();
  return (
    <>
      <PageHeader
        backLink={{
          href: batchTransactionPath(report.alert.batchId, report.alert.transactionId),
          label: t.fauReports.backToTransaction,
        }}
        title={report.referenceNumber}
        meta={<FauReportStatusBadge status={report.status} />}
        description={t.fauReports.description}
        actions={
          <Button
            variant="secondary"
            icon={<Download aria-hidden="true" />}
            onClick={() => downloadReport(report)}
          >
            {t.fauReports.download}
          </Button>
        }
      />
      <Notice tone="compliance">{t.fauReports.complianceNotice}</Notice>
      <div className={styles.overview}>
        <FauReportWorkflowCard report={report} />
        <FauReportDeadlinesCard report={report} />
      </div>
      <FauReportSections report={report} isEditable={canEditFauReport(report) && canPrepareFauReport} />
      <FauReportHistory history={report.history} />
    </>
  );
}

function ViewableFauReport({ reportId }: { reportId: string }) {
  const reportQuery = useFauReport(reportId);
  return <QueryView query={reportQuery}>{(report) => <FauReportDetail report={report} />}</QueryView>;
}

/** Issue #20. Only roles allowed to view a report load its content (§ 38 AML zákona). */
export function FauReportScreen({ reportId }: { reportId: string }) {
  const { t } = useI18n();
  const { canUseFauReports } = useFauReportsCapabilities();
  const { canViewFauReports } = useRolePermissions();
  if (!canUseFauReports) {
    return <EmptyState message={t.fauReports.unsupported} />;
  }
  if (!canViewFauReports) {
    return (
      <>
        <PageHeader title={t.fauReports.title} />
        <RoleGateNotice permission="canViewFauReports" />
      </>
    );
  }
  return <ViewableFauReport reportId={reportId} />;
}
