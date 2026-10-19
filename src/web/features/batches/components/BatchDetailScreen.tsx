"use client";

import Link from "next/link";

import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryView } from "@/components/ui/StateViews";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime, formatNumber } from "@/lib/format";

import { useBatch } from "../api/hooks";
import { BUCKETS, type Batch, type Bucket } from "../types";
import { BatchStatusBadge } from "./BatchesScreen";
import { BatchProgressView } from "./BatchProgressView";
import { BatchTransactionList } from "./BatchTransactionList";
import { BUCKET_ICONS } from "./BucketBadge";
import styles from "./BatchDetail.module.css";

function BucketCards({ batch, selectedBucket }: { batch: Batch; selectedBucket: Bucket | null }) {
  const { t, locale } = useI18n();
  return (
    <div className={`${styles.bucketCards} rf-stagger`}>
      {BUCKETS.map((bucket) => {
        const BucketIcon = BUCKET_ICONS[bucket];
        const isSelected = bucket === selectedBucket;
        return (
          <Link
            key={bucket}
            href={`/batches/${batch.id}?bucket=${bucket}`}
            scroll={false}
            className={`${styles.bucketCard} ${styles[bucket]} ${isSelected ? styles.bucketCardSelected : ""}`}
            aria-current={isSelected ? "true" : undefined}
          >
            <BucketIcon aria-hidden="true" className={styles.bucketIcon} />
            <span className={styles.bucketCount}>
              <AnimatedCounter value={batch.counts[bucket]} format={(value) => formatNumber(value, locale)} />
            </span>
            <span className={styles.bucketLabel}>{t.bucket[bucket]}</span>
          </Link>
        );
      })}
    </div>
  );
}

function BatchDetail({ batch, selectedBucket }: { batch: Batch; selectedBucket: Bucket | null }) {
  const { t, locale } = useI18n();
  const isCapped = batch.evaluatedRowCount < batch.fileRowCount;
  return (
    <>
      <PageHeader
        backLink={{ href: "/batches", label: t.batches.title }}
        title={batch.fileName}
        meta={
          <>
            <BatchStatusBadge status={batch.status} />
            <span className={styles.headerMeta}>
              {formatDateTime(batch.uploadedAt, locale)} · {t.batches.uploadedBy}: {batch.uploadedBy} ·{" "}
              {t.batches.rulesOfBatch}: {batch.activeRuleCount}
            </span>
          </>
        }
      />
      {isCapped && (
        <Notice tone="info">
          {formatMessage(t.batches.capNote, {
            evaluated: formatNumber(batch.evaluatedRowCount, locale),
            total: formatNumber(batch.fileRowCount, locale),
          })}
        </Notice>
      )}
      {batch.status === "processing" ? (
        <BatchProgressView batch={batch} />
      ) : (
        <>
          <Card title={t.batches.resultTitle}>
            <BucketCards batch={batch} selectedBucket={selectedBucket} />
            <Notice tone="ai">{t.batches.decisionAid}</Notice>
          </Card>
          {selectedBucket ? (
            <Card title={`${t.batches.transactionsIn}: ${t.bucket[selectedBucket]}`}>
              <BatchTransactionList key={selectedBucket} batchId={batch.id} bucket={selectedBucket} />
            </Card>
          ) : (
            <p className={styles.bucketHint}>{t.batches.clickBucket}</p>
          )}
        </>
      )}
    </>
  );
}

export function BatchDetailScreen({
  batchId,
  selectedBucket,
}: {
  batchId: string;
  selectedBucket: Bucket | null;
}) {
  const batchQuery = useBatch(batchId);
  return (
    <QueryView query={batchQuery}>
      {(batch) => <BatchDetail batch={batch} selectedBucket={selectedBucket} />}
    </QueryView>
  );
}
