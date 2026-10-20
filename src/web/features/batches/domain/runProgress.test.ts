import {
  advanceProgressMark,
  advanceRateSample,
  estimateCountdownMs,
  findLastPolledAtMs,
  findStalledSinceMs,
  RATE_SMOOTHING_FACTOR,
  restartProgressWatch,
  STALLED_RUN_LIMIT_MS,
  type RateSample,
} from "./runProgress";

const FETCHED_AT_MS = 1_000_000;

function run(processedRowCount: number, status: "processing" | "completed" = "processing") {
  return { id: "run-1", status, processedRowCount, evaluatedRowCount: 100 };
}

describe("advanceProgressMark and findStalledSinceMs", () => {
  it("waits for the first fetch", () => {
    expect(advanceProgressMark(null, undefined, 0)).toBeNull();
    expect(findStalledSinceMs(null, FETCHED_AT_MS)).toBeNull();
  });

  it("keeps the mark while the progress is unchanged and reports a stall after the limit", () => {
    const mark = advanceProgressMark(null, [run(10)], FETCHED_AT_MS);
    const laterFetchMs = FETCHED_AT_MS + STALLED_RUN_LIMIT_MS;

    expect(advanceProgressMark(mark, [run(10)], laterFetchMs - 1)).toBe(mark);
    expect(findStalledSinceMs(mark, laterFetchMs - 1)).toBeNull();
    expect(findStalledSinceMs(mark, laterFetchMs)).toBe(FETCHED_AT_MS);
  });

  it("restarts the limit when the progress changes", () => {
    const mark = advanceProgressMark(null, [run(10)], FETCHED_AT_MS);
    const progressedMark = advanceProgressMark(mark, [run(11)], FETCHED_AT_MS + STALLED_RUN_LIMIT_MS);

    expect(progressedMark?.changedAtMs).toBe(FETCHED_AT_MS + STALLED_RUN_LIMIT_MS);
    expect(findStalledSinceMs(progressedMark, FETCHED_AT_MS + STALLED_RUN_LIMIT_MS)).toBeNull();
  });

  it("restarts the limit on check again and still reports the time of the last change", () => {
    const mark = advanceProgressMark(null, [run(10)], FETCHED_AT_MS);
    const checkAgainMs = FETCHED_AT_MS + 2 * STALLED_RUN_LIMIT_MS;
    const restartedMark = restartProgressWatch(mark, checkAgainMs);

    expect(findStalledSinceMs(restartedMark, checkAgainMs + STALLED_RUN_LIMIT_MS - 1)).toBeNull();
    expect(findStalledSinceMs(restartedMark, checkAgainMs + STALLED_RUN_LIMIT_MS)).toBe(FETCHED_AT_MS);
  });

  it("counts failed polls, so a backend that is down still ends the polling", () => {
    const mark = advanceProgressMark(null, [run(10)], FETCHED_AT_MS);
    const polledAtMs = findLastPolledAtMs({
      dataUpdatedAt: FETCHED_AT_MS,
      errorUpdatedAt: FETCHED_AT_MS + STALLED_RUN_LIMIT_MS,
    });

    expect(findStalledSinceMs(mark, polledAtMs)).toBe(FETCHED_AT_MS);
  });

  it("never reports a stall once nothing is processing", () => {
    const mark = advanceProgressMark(null, [run(100, "completed")], FETCHED_AT_MS);

    expect(findStalledSinceMs(mark, FETCHED_AT_MS + 2 * STALLED_RUN_LIMIT_MS)).toBeNull();
  });
});

describe("advanceRateSample and estimateCountdownMs", () => {
  const totalCount = 1000;

  it("gives no estimate from the first sample", () => {
    const sample = advanceRateSample(null, 100, FETCHED_AT_MS);

    expect(sample).toEqual({ processedCount: 100, sampledAtMs: FETCHED_AT_MS, msPerTx: null });
    expect(estimateCountdownMs({ sample, totalCount, nowMs: FETCHED_AT_MS })).toBeNull();
    expect(advanceRateSample(null, 100, 0)).toBeNull();
  });

  it("counts down at a stable rate between polls", () => {
    const first = advanceRateSample(null, 100, FETCHED_AT_MS);
    const second = advanceRateSample(first, 200, FETCHED_AT_MS + 2000);
    const third = advanceRateSample(second, 300, FETCHED_AT_MS + 4000);

    expect(third?.msPerTx).toBe(20);
    // 700 transactions left at 20 ms each, then 1 s less a second after the poll.
    expect(estimateCountdownMs({ sample: third, totalCount, nowMs: FETCHED_AT_MS + 4000 })).toBe(14_000);
    expect(estimateCountdownMs({ sample: third, totalCount, nowMs: FETCHED_AT_MS + 5000 })).toBe(13_000);
  });

  it("smooths a slowdown instead of jumping to the newest rate", () => {
    const first = advanceRateSample(null, 100, FETCHED_AT_MS);
    const second = advanceRateSample(first, 200, FETCHED_AT_MS + 2000);
    const slower = advanceRateSample(second, 220, FETCHED_AT_MS + 4000);

    // The newest poll measured 100 ms per transaction against the 20 ms so far.
    expect(slower?.msPerTx).toBeCloseTo(20 + RATE_SMOOTHING_FACTOR * (100 - 20));
  });

  it("keeps the sample while there is no progress and keeps counting down", () => {
    const first = advanceRateSample(null, 100, FETCHED_AT_MS);
    const second = advanceRateSample(first, 200, FETCHED_AT_MS + 2000) as RateSample;

    expect(advanceRateSample(second, 200, FETCHED_AT_MS + 4000)).toBe(second);
    expect(estimateCountdownMs({ sample: second, totalCount, nowMs: FETCHED_AT_MS + 4000 })).toBe(14_000);
    expect(estimateCountdownMs({ sample: second, totalCount, nowMs: FETCHED_AT_MS + 60_000 })).toBe(0);
  });

  it("reports nothing left once every transaction is processed", () => {
    const first = advanceRateSample(null, 900, FETCHED_AT_MS);
    const completed = advanceRateSample(first, 1000, FETCHED_AT_MS + 2000);

    expect(estimateCountdownMs({ sample: completed, totalCount, nowMs: FETCHED_AT_MS + 2000 })).toBe(0);
  });

  it("gives no estimate without a total", () => {
    const first = advanceRateSample(null, 100, FETCHED_AT_MS);
    const second = advanceRateSample(first, 200, FETCHED_AT_MS + 2000);

    expect(estimateCountdownMs({ sample: second, totalCount: 0, nowMs: FETCHED_AT_MS + 2000 })).toBeNull();
  });
});
