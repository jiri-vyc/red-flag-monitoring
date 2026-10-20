import type { Batch } from "../types";

/**
 * A processing run whose counts have not changed for this long is shown as not responding and polling stops.
 * The backend does not clean up runs orphaned by a restart yet, so without a limit such a run is polled forever.
 */
export const STALLED_RUN_LIMIT_MS = 5 * 60_000;
/** Weight of the newest poll in the smoothed rate: high enough to follow a slowdown, low enough to damp noise. */
export const RATE_SMOOTHING_FACTOR = 0.3;

type ProgressBatch = Pick<Batch, "id" | "status" | "processedRowCount" | "evaluatedRowCount">;

/**
 * The progress of the processing runs, when it last changed and when the current limit window started: the
 * change itself, or a later "check again".
 */
export type ProgressMark = { signature: string; changedAtMs: number; watchedFromMs: number };

/** Empty when nothing is processing, so a finished run never reads as stalled. */
function describeProgress(batches: ProgressBatch[]): string {
  return batches
    .filter((batch) => batch.status === "processing")
    .map((batch) => `${batch.id}:${batch.evaluatedRowCount}:${batch.processedRowCount}`)
    .join("|");
}

/** Keeps the mark while the progress is unchanged; a fetchedAtMs of 0 means nothing is loaded yet. */
export function advanceProgressMark(
  mark: ProgressMark | null,
  batches: ProgressBatch[] | undefined,
  fetchedAtMs: number,
): ProgressMark | null {
  if (!batches || fetchedAtMs === 0) {
    return mark;
  }
  const signature = describeProgress(batches);
  return mark?.signature === signature
    ? mark
    : { signature, changedAtMs: fetchedAtMs, watchedFromMs: fetchedAtMs };
}

/** Starts a new limit window at nowMs and keeps when the progress last changed. */
export function restartProgressWatch(mark: ProgressMark | null, nowMs: number): ProgressMark | null {
  return mark && { ...mark, watchedFromMs: nowMs };
}

/**
 * When the processing runs last changed, if the latest poll (successful or failed, so a backend that is down
 * is caught too) came at least limitMs into the limit window; else null.
 */
export function findStalledSinceMs(
  mark: ProgressMark | null,
  polledAtMs: number,
  limitMs: number = STALLED_RUN_LIMIT_MS,
): number | null {
  if (!mark || mark.signature === "") {
    return null;
  }
  return polledAtMs - mark.watchedFromMs >= limitMs ? mark.changedAtMs : null;
}

/** Client time of the latest poll, whether it returned data or failed. */
export function findLastPolledAtMs({
  dataUpdatedAt,
  errorUpdatedAt,
}: {
  dataUpdatedAt: number;
  errorUpdatedAt: number;
}): number {
  return Math.max(dataUpdatedAt, errorUpdatedAt);
}

/** The last poll that showed progress and the smoothed time per transaction; null until two polls differ. */
export type RateSample = { processedCount: number; sampledAtMs: number; msPerTx: number | null };

/**
 * Measures the rate between consecutive polls (server progress over client fetch times) and smooths it with
 * an exponential moving average. A poll without progress keeps the sample, so the next progress is measured
 * over the whole gap and a slowdown shows up in the rate.
 */
export function advanceRateSample(
  sample: RateSample | null,
  processedCount: number,
  sampledAtMs: number,
): RateSample | null {
  if (sampledAtMs === 0) {
    return sample;
  }
  if (!sample) {
    return { processedCount, sampledAtMs, msPerTx: null };
  }
  const processedDelta = processedCount - sample.processedCount;
  const elapsedMs = sampledAtMs - sample.sampledAtMs;
  if (processedDelta <= 0 || elapsedMs <= 0) {
    return sample;
  }
  const pollMsPerTx = elapsedMs / processedDelta;
  const msPerTx =
    sample.msPerTx === null
      ? pollMsPerTx
      : sample.msPerTx + RATE_SMOOTHING_FACTOR * (pollMsPerTx - sample.msPerTx);
  return { processedCount, sampledAtMs, msPerTx };
}

/**
 * Time left at the smoothed rate, counted down from the last sample so it decreases between polls.
 * Null while the total or the rate is unknown.
 */
export function estimateCountdownMs({
  sample,
  totalCount,
  nowMs,
}: {
  sample: RateSample | null;
  totalCount: number;
  nowMs: number;
}): number | null {
  if (!sample || sample.msPerTx === null || totalCount <= 0) {
    return null;
  }
  const remainingAtSampleMs = Math.max(0, totalCount - sample.processedCount) * sample.msPerTx;
  return Math.max(0, remainingAtSampleMs - (nowMs - sample.sampledAtMs));
}
