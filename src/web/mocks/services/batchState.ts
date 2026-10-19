import type { Batch } from "@/features/batches/types";

import { countBuckets } from "../evaluation/batchEvaluation";
import { readBatchRows, type MockBatchRecord } from "../store/mockDatabase";

/** Fraction of the simulated processing window that has elapsed, between 0 and 1. */
function calculateProgressFraction(record: MockBatchRecord, nowMs: number): number {
  if (record.durationMs <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, (nowMs - record.startedAtMs) / record.durationMs));
}

export function countProcessedRows(record: MockBatchRecord, nowMs: number): number {
  return Math.floor(record.batch.evaluatedRowCount * calculateProgressFraction(record, nowMs));
}

export function mapBatchRecord(record: MockBatchRecord, nowMs: number = Date.now()): Batch {
  const processedRowCount = countProcessedRows(record, nowMs);
  const isCompleted = processedRowCount >= record.batch.evaluatedRowCount;
  const processedRows = readBatchRows(record.batch.id).slice(0, processedRowCount);
  return {
    ...record.batch,
    status: isCompleted ? "completed" : "processing",
    processedRowCount,
    counts: countBuckets(processedRows),
  };
}
