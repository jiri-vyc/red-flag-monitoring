"use client";

import { Clock, ListChecks } from "lucide-react";
import { useState } from "react";

import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { LoadingRing } from "@/components/ui/LoadingRing";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatApproximateDuration, formatElapsedTime, formatNumber } from "@/lib/format";
import { useNow } from "@/lib/useNow";

import { advanceRateSample, estimateCountdownMs, type RateSample } from "../domain/runProgress";
import type { Batch } from "../types";
import { BucketCountsInline } from "./BucketCountsInline";
import styles from "./BatchDetail.module.css";

const ELAPSED_TICK_MS = 1000;

type BatchProgressProps = {
  batch: Batch;
  /** Client time of the fetch that returned the batch; the ETA measures the rate between fetches. */
  fetchedAtMs: number;
  /** A stalled run shows no ETA: it would count down to nothing next to the not-responding notice. */
  isStalled: boolean;
};

/**
 * Elapsed time since the run started and, once two polls show progress, the time left at the smoothed rate,
 * counted down between polls.
 */
function RunTiming({ batch, fetchedAtMs, isStalled }: BatchProgressProps) {
  const { t } = useI18n();
  const nowMs = useNow(ELAPSED_TICK_MS, batch.status === "processing");
  const [rateSample, setRateSample] = useState<RateSample | null>(null);
  const nextRateSample = advanceRateSample(rateSample, batch.processedRowCount, fetchedAtMs);
  if (nextRateSample !== rateSample) {
    // Adjusting state during render: React re-renders right away with the new sample.
    setRateSample(nextRateSample);
  }
  const remainingMs = estimateCountdownMs({
    sample: nextRateSample,
    totalCount: batch.evaluatedRowCount,
    // The tick lags a new poll by up to a second; the countdown never starts before its sample.
    nowMs: Math.max(nowMs, fetchedAtMs),
  });
  return (
    <p className={styles.progressMeta}>
      <Clock aria-hidden="true" />
      {formatMessage(t.batches.elapsedTime, {
        time: formatElapsedTime(nowMs - Date.parse(batch.uploadedAt)),
      })}
      {remainingMs !== null && !isStalled && (
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

export function BatchProgressView({ batch, fetchedAtMs, isStalled }: BatchProgressProps) {
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
        <RunTiming batch={batch} fetchedAtMs={fetchedAtMs} isStalled={isStalled} />
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
