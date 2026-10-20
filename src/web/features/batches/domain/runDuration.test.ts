import type { Batch } from "../types";
import {
  APPROX_FULL_DATASET_TX,
  DEFAULT_MS_PER_100K_TX,
  estimateMsPer100kTx,
  estimateRunDurationMs,
  estimateThroughput,
  RUN_OVERHEAD_MS,
  findFullDatasetTxCount,
} from "./runDuration";

type RunOverrides = Partial<Batch> & { durationSeconds?: number };

const START = "2026-10-19T10:00:00.000Z";

function createRun({ durationSeconds = 0, ...overrides }: RunOverrides): Batch {
  const uploadedAt = overrides.uploadedAt ?? START;
  return {
    id: "run",
    fileName: "database",
    uploadedAt,
    finishedAt: new Date(Date.parse(uploadedAt) + durationSeconds * 1000).toISOString(),
    uploadedBy: "analyst",
    status: "completed",
    fileRowCount: 0,
    evaluatedRowCount: overrides.processedRowCount ?? 0,
    processedRowCount: 0,
    activeRuleCount: 1,
    counts: { ok: 0, to_check: 0, alert: 0 },
    failureReason: null,
    isFullDatasetRun: false,
    ...overrides,
  };
}

describe("estimateThroughput", () => {
  it("falls back to the default when no completed run is large enough", () => {
    const estimate = estimateThroughput([
      createRun({ processedRowCount: 1000, durationSeconds: 8 }),
      createRun({ processedRowCount: 80_000, status: "failed", durationSeconds: 60 }),
      createRun({ processedRowCount: 90_000, status: "processing", finishedAt: null }),
    ]);

    expect(estimate).toEqual({
      msPerTx: DEFAULT_MS_PER_100K_TX / 100_000,
      source: "default",
      measuredRun: null,
    });
    expect(estimateMsPer100kTx(estimate)).toBe(DEFAULT_MS_PER_100K_TX);
  });

  it("uses the most recent completed run with at least 50,000 transactions", () => {
    const estimate = estimateThroughput([
      createRun({ processedRowCount: 100_000, durationSeconds: 100, uploadedAt: "2026-10-18T10:00:00.000Z" }),
      createRun({ processedRowCount: 397_853, durationSeconds: 253, uploadedAt: "2026-10-19T10:00:00.000Z" }),
      createRun({ processedRowCount: 1000, durationSeconds: 8, uploadedAt: "2026-10-19T11:00:00.000Z" }),
    ]);

    expect(estimate.source).toBe("last_run");
    expect(estimate.measuredRun).toEqual({ txCount: 397_853, durationMs: 253_000 });
    expect(estimateRunDurationMs(397_853, estimate)).toBeCloseTo(253_000);
    // (253 s − 5 s overhead) / 397,853 tx × 100,000
    expect(estimateMsPer100kTx(estimate)).toBeCloseTo(62_335, 0);
  });

  it("skips a run with an unusable duration", () => {
    const estimate = estimateThroughput([createRun({ processedRowCount: 60_000, durationSeconds: 0 })]);

    expect(estimate.source).toBe("default");
  });
});

describe("findFullDatasetTxCount", () => {
  it("takes the newest completed full-dataset run, else the approximate total", () => {
    expect(findFullDatasetTxCount([createRun({ processedRowCount: 1000 })])).toBe(APPROX_FULL_DATASET_TX);
    expect(
      findFullDatasetTxCount([
        createRun({
          evaluatedRowCount: 390_000,
          isFullDatasetRun: true,
          uploadedAt: "2026-10-18T10:00:00.000Z",
        }),
        createRun({
          evaluatedRowCount: 397_853,
          isFullDatasetRun: true,
          uploadedAt: "2026-10-19T10:00:00.000Z",
        }),
        createRun({ evaluatedRowCount: 400_100, isFullDatasetRun: true, status: "processing" }),
      ]),
    ).toBe(397_853);
  });
});

describe("estimateRunDurationMs", () => {
  it("adds the fixed overhead, so a small limit is not reported as a second", () => {
    const throughput = estimateThroughput([]);
    expect(estimateRunDurationMs(1000, throughput)).toBeCloseTo(RUN_OVERHEAD_MS + 650, 0);
  });
});
