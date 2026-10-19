"use client";

import { Clock, ListChecks } from "lucide-react";

import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { LoadingRing } from "@/components/ui/LoadingRing";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatApproximateDuration, formatElapsedTime, formatNumber } from "@/lib/format";
import { useNow } from "@/lib/useNow";

import { ETA_MIN_ELAPSED_MS, useBatchesMode } from "../api/hooks";
import { estimateRemainingMs } from "../domain/runDuration";
import type { Batch } from "../types";
import { BucketCountsInline } from "./BucketCountsInline";
import styles from "./BatchDetail.module.css";

const ELAPSED_TICK_MS = 1000;

/** Elapsed time since the run started and, once the rate is measurable, the time left at that rate. */
function RunTiming({ batch }: { batch: Batch }) {
  const { t } = useI18n();
  const batchesMode = useBatchesMode();
  const nowMs = useNow(ELAPSED_TICK_MS, batch.status === "processing");
  const remainingMs = estimateRemainingMs({
    processedCount: batch.processedRowCount,
    totalCount: batch.evaluatedRowCount,
    startedAt: batch.uploadedAt,
    nowMs,
    minElapsedMs: ETA_MIN_ELAPSED_MS[batchesMode],
  });
  return (
    <p className={styles.progressMeta}>
      <Clock aria-hidden="true" />
      {formatMessage(t.batches.elapsedTime, {
        time: formatElapsedTime(nowMs - Date.parse(batch.uploadedAt)),
      })}
      {remainingMs !== null && (
        <>
          {" · "}
          <strong>
            {formatMessage(t.batches.remainingEstimate, { duration: formatApproximateDuration(remainingMs) })}
          </strong>
        </>
      )}
    </p>
  );
}

export function BatchProgressView({ batch }: { batch: Batch }) {
  const { t, locale } = useI18n();
  // A run whose total is not known yet (e.g. still importing) shows an indeterminate ring and the count only.
  const isTotalKnown = batch.evaluatedRowCount > 0;
  const percent = isTotalKnown ? (batch.processedRowCount / batch.evaluatedRowCount) * 100 : 0;
  return (
    <section className={`${styles.progressPanel} rf-fade-in`} aria-live="polite">
      {isTotalKnown ? (
        <ProgressRing percent={percent} label={t.batches.evaluating} />
      ) : (
        <LoadingRing label={t.batches.evaluating} />
      )}
      <div className={styles.progressText}>
        <h2>{t.batches.evaluating}</h2>
        <p className={styles.progressCount}>
          <AnimatedCounter value={batch.processedRowCount} format={(value) => formatNumber(value, locale)} />
          <span className={styles.progressTotal}>
            {" "}
            {isTotalKnown
              ? `/ ${formatNumber(batch.evaluatedRowCount, locale)} ${t.batches.processedOf}`
              : t.batches.processedSoFar}
          </span>
        </p>
        {isTotalKnown && <ProgressBar percent={percent} label={t.batches.evaluating} />}
        <RunTiming batch={batch} />
        <p className={styles.progressMeta}>
          <ListChecks aria-hidden="true" />
          {t.batches.activeRulesUsed}: <strong>{batch.activeRuleCount}</strong>
        </p>
        <div className={styles.progressMeta}>
          {t.batches.foundSoFar}: <BucketCountsInline counts={batch.counts} />
        </div>
      </div>
    </section>
  );
}
