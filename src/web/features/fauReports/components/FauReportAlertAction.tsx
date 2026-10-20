"use client";

import { FileWarning } from "lucide-react";
import { useRouter } from "next/navigation";

import { ButtonLink } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/StateViews";
import type { TransactionEvaluation } from "@/features/batches/types";
import { useRolePermissions } from "@/features/users/api/hooks";
import { RoleGatedButton } from "@/features/users/components/RoleGatedButton";
import { useI18n } from "@/i18n/I18nProvider";

import { useCreateFauReport, useFauReportForAlert, useFauReportsCapabilities } from "../api/hooks";
import { fauReportPath } from "../fauReportPaths";
import type { FauReportSummary } from "../types";
import styles from "./FauReport.module.css";
import { FauReportStatusBadge } from "./FauReportStatusBadge";

/** Other roles learn only that a report exists and its state, never its content (§ 38 AML zákona). */
function ExistingReport({ report }: { report: FauReportSummary }) {
  const { t } = useI18n();
  const { canViewFauReports } = useRolePermissions();
  return (
    <div className={styles.alertAction}>
      {canViewFauReports ? (
        <ButtonLink
          variant="secondary"
          href={fauReportPath(report.id)}
          icon={<FileWarning aria-hidden="true" />}
        >
          {t.fauReports.openReport}
        </ButtonLink>
      ) : (
        <span className={styles.alertActionLabel}>{t.fauReports.reportExists}</span>
      )}
      <FauReportStatusBadge status={report.status} />
    </div>
  );
}

function PrepareReportButton({ evaluation }: { evaluation: TransactionEvaluation }) {
  const { t } = useI18n();
  const router = useRouter();
  const createMutation = useCreateFauReport();
  return (
    <div className={styles.alertAction}>
      <RoleGatedButton
        permission="canPrepareFauReport"
        variant="danger"
        icon={<FileWarning aria-hidden="true" />}
        disabled={createMutation.isPending}
        onClick={() =>
          createMutation.mutate(evaluation, { onSuccess: (report) => router.push(fauReportPath(report.id)) })
        }
      >
        {createMutation.isPending ? t.fauReports.preparing : t.fauReports.prepare}
      </RoleGatedButton>
      {createMutation.error && <ErrorState error={createMutation.error} />}
    </div>
  );
}

function AlertReportAction({ evaluation }: { evaluation: TransactionEvaluation }) {
  const reportQuery = useFauReportForAlert({
    batchId: evaluation.batchId,
    transactionId: evaluation.transaction.transactionId,
  });
  if (reportQuery.isPending) {
    return null;
  }
  if (reportQuery.isError) {
    return <ErrorState error={reportQuery.error} onRetry={() => void reportQuery.refetch()} />;
  }
  return reportQuery.data ? (
    <ExistingReport report={reportQuery.data} />
  ) : (
    <PrepareReportButton evaluation={evaluation} />
  );
}

/** Issue #20: from a transaction with an alert, prepare the FAÚ report or open the existing one. */
export function FauReportAlertAction({ evaluation }: { evaluation: TransactionEvaluation }) {
  const { canUseFauReports } = useFauReportsCapabilities();
  if (!canUseFauReports || evaluation.bucket !== "alert") {
    return null;
  }
  return <AlertReportAction evaluation={evaluation} />;
}
