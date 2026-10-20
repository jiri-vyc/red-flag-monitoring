"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import tableStyles from "@/components/ui/DataTable.module.css";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, QueryView } from "@/components/ui/StateViews";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime, formatNumber } from "@/lib/format";

import { useBatches, useBatchesCapabilities } from "../api/hooks";
import { batchPath } from "../batchPaths";
import type { Batch, BatchStatus } from "../types";
import { BucketCountsInline } from "./BucketCountsInline";
import { RunEvaluationPanel } from "./RunEvaluationPanel";
import { UploadDropzone } from "./UploadDropzone";

const STATUS_TONES: Record<BatchStatus, "primary" | "success" | "danger"> = {
  processing: "primary",
  completed: "success",
  failed: "danger",
};

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const { t } = useI18n();
  return <Badge tone={STATUS_TONES[status]}>{t.batches.statusLabel[status]}</Badge>;
}

function BatchHistoryTable({ batches }: { batches: Batch[] }) {
  const { t, locale } = useI18n();
  if (batches.length === 0) {
    return <EmptyState message={t.batches.empty} />;
  }
  return (
    <div className={tableStyles.wrapper}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th scope="col">{t.batches.file}</th>
            <th scope="col">{t.batches.uploadedAt}</th>
            <th scope="col" className={tableStyles.numeric}>
              {t.batches.rows}
            </th>
            <th scope="col">{t.common.status}</th>
            <th scope="col">{t.batches.results}</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <tr key={batch.id}>
              <td>
                <Link href={batchPath(batch.id)} className={tableStyles.primaryCell}>
                  {batch.fileName}
                  <span className={`${tableStyles.secondaryText} ${tableStyles.mono}`}>{batch.id}</span>
                </Link>
              </td>
              <td>
                <span className={tableStyles.primaryCell}>
                  {formatDateTime(batch.uploadedAt, locale)}
                  <span className={tableStyles.secondaryText}>{batch.uploadedBy}</span>
                </span>
              </td>
              <td className={tableStyles.numeric}>
                {formatNumber(batch.evaluatedRowCount, locale)}
                {batch.evaluatedRowCount < batch.fileRowCount && (
                  <span className={tableStyles.secondaryText}>
                    {" "}
                    / {formatNumber(batch.fileRowCount, locale)}
                  </span>
                )}
              </td>
              <td>
                <BatchStatusBadge status={batch.status} />
              </td>
              <td>
                <BucketCountsInline counts={batch.counts} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BatchesScreen() {
  const { t } = useI18n();
  const batchesQuery = useBatches();
  const { canUploadBatch, canStartRun } = useBatchesCapabilities();
  return (
    <>
      <PageHeader
        title={t.batches.title}
        description={canUploadBatch ? t.batches.subtitle : t.batches.subtitleReadOnly}
      />
      {canStartRun && <RunEvaluationPanel />}
      {canUploadBatch && <UploadDropzone />}
      <Card title={t.batches.history}>
        <QueryView query={batchesQuery}>{(batches) => <BatchHistoryTable batches={batches} />}</QueryView>
      </Card>
    </>
  );
}
