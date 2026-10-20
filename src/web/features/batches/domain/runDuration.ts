import type { Batch } from "../types";

/**
 * Fallback speed when no recent run is large enough to measure. Measured on Aurora `main`: a full run of
 * 397,853 transactions took 253 s, which is about 65 s per 100,000 transactions.
 */
export const DEFAULT_MS_PER_100K_TX = 65_000;
/** Smaller runs are dominated by their fixed overhead (1,000 transactions took 8 s), so they skew the speed. */
export const MIN_MEASURED_RUN_TX = 50_000;
/** Size of a full run when no completed full-dataset run tells the real count. */
export const APPROX_FULL_DATASET_TX = 400_000;
/** Fixed start-up cost of a run (Aurora main: 1,000 transactions took 8 s, 2,000 took 5 s), added once per estimate. */
export const RUN_OVERHEAD_MS = 5000;

const TX_PER_100K = 100_000;

export type ThroughputSource = "last_run" | "default";

export type MeasuredRun = { txCount: number; durationMs: number };

export type ThroughputEstimate = {
  msPerTx: number;
  source: ThroughputSource;
  /** The run the speed comes from; null for the default. */
  measuredRun: MeasuredRun | null;
};

type RunTiming = Pick<Batch, "status" | "processedRowCount" | "uploadedAt" | "finishedAt">;

function measureRun(run: RunTiming): MeasuredRun | null {
  if (run.status !== "completed" || run.finishedAt === null || run.processedRowCount < MIN_MEASURED_RUN_TX) {
    return null;
  }
  const durationMs = Date.parse(run.finishedAt) - Date.parse(run.uploadedAt);
  return Number.isFinite(durationMs) && durationMs > 0
    ? { txCount: run.processedRowCount, durationMs }
    : null;
}

function byNewestFirst(left: Pick<Batch, "uploadedAt">, right: Pick<Batch, "uploadedAt">): number {
  return Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt);
}

/** Speed of the most recent completed run with at least MIN_MEASURED_RUN_TX transactions, else the default. */
export function estimateThroughput(runs: RunTiming[]): ThroughputEstimate {
  const measuredRun = [...runs]
    .sort(byNewestFirst)
    .map(measureRun)
    .find((measured) => measured !== null);
  if (!measuredRun) {
    return { msPerTx: DEFAULT_MS_PER_100K_TX / TX_PER_100K, source: "default", measuredRun: null };
  }
  // The measured duration already includes the fixed overhead, so the speed is taken without it.
  const processingMs = Math.max(measuredRun.durationMs - RUN_OVERHEAD_MS, measuredRun.durationMs / 2);
  return { msPerTx: processingMs / measuredRun.txCount, source: "last_run", measuredRun };
}

/** Whole run: fixed overhead plus the transactions at the measured speed, so small limits are not underestimated. */
export function estimateRunDurationMs(txCount: number, throughput: ThroughputEstimate): number {
  return RUN_OVERHEAD_MS + txCount * throughput.msPerTx;
}

/** Pure speed without the overhead, shown as "per 100,000 transactions". */
export function estimateMsPer100kTx(throughput: ThroughputEstimate): number {
  return TX_PER_100K * throughput.msPerTx;
}

/** Transactions of the newest completed full-dataset run, else APPROX_FULL_DATASET_TX. */
export function findFullDatasetTxCount(
  runs: Pick<Batch, "status" | "isFullDatasetRun" | "evaluatedRowCount" | "uploadedAt">[],
): number {
  const fullRun = [...runs]
    .sort(byNewestFirst)
    .find((run) => run.status === "completed" && run.isFullDatasetRun && run.evaluatedRowCount > 0);
  return fullRun?.evaluatedRowCount ?? APPROX_FULL_DATASET_TX;
}
