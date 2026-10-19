"use client";

import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatApproximateDuration, formatDuration, formatNumber } from "@/lib/format";

import {
  estimateMsPer100kTx,
  estimateRunDurationMs,
  MIN_MEASURED_RUN_TX,
  type ThroughputEstimate,
} from "../domain/runDuration";
import styles from "./RunEvaluationPanel.module.css";

type RunDurationEstimateProps = {
  /** Transactions the run evaluates: the full dataset or at most the limit. */
  txCount: number;
  isFullRun: boolean;
  throughput: ThroughputEstimate;
};

/** Lines of the run panel notice; they render inside the notice's paragraph, so they are inline elements. */
export function RunDurationEstimate({ txCount, isFullRun, throughput }: RunDurationEstimateProps) {
  const { t, locale } = useI18n();
  const runMessage = isFullRun ? t.batches.durationFullRun : t.batches.durationLimitedRun;
  const { measuredRun } = throughput;
  return (
    <>
      <span className={styles.estimateLine}>
        <strong>
          {formatMessage(runMessage, {
            count: formatNumber(txCount, locale),
            duration: formatApproximateDuration(estimateRunDurationMs(txCount, throughput)),
          })}
        </strong>
      </span>
      <span className={styles.estimateLine}>
        {formatMessage(t.batches.durationPer100k, {
          duration: formatApproximateDuration(estimateMsPer100kTx(throughput)),
        })}{" "}
        {measuredRun
          ? formatMessage(t.batches.durationBasedOnLastRun, {
              count: formatNumber(measuredRun.txCount, locale),
              duration: formatDuration(measuredRun.durationMs),
            })
          : formatMessage(t.batches.durationBasedOnDefault, {
              count: formatNumber(MIN_MEASURED_RUN_TX, locale),
            })}
      </span>
      <span className={styles.estimateLine}>{t.batches.durationCaveat}</span>
    </>
  );
}
