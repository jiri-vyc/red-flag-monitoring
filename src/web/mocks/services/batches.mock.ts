import type { BatchesService } from "@/features/batches/api/contract";
import type { Batch, RunScope, Transaction } from "@/features/batches/types";
import type { MockBatchRecord } from "../store/mockDatabase";
import { ApiError } from "@/lib/apiError";

import { createMockId } from "../createMockId";
import { createRuleSnapshots, evaluateBatchRows } from "../evaluation/batchEvaluation";
import { CsvFormatError, mapCsvRowToTransaction, parseTransactionsCsv } from "../evaluation/csvTransactions";
import { evaluateTransaction } from "../evaluation/evaluateTransaction";
import { simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import { SEED_TRANSACTIONS } from "../seed/transactions";
import { readBatchRows, readMockDatabase, writeBatchRows, writeMockDatabase } from "../store/mockDatabase";
import { countProcessedRows, mapBatchRecord } from "./batchState";

/** localStorage holds ~5 MB, so the mock evaluates only the first rows of large files. */
export const MOCK_BATCH_ROW_CAP = 2000;
const TRANSACTION_PAGE_SIZE = 25;
const MIN_PROCESSING_MS = 3000;
const MAX_EXTRA_PROCESSING_MS = 5000;
// Batch name of a run started without a file. It is data, not UI, like the rest of the mock data.
const SEED_RUN_NAME = "Běh nad demo transakcemi";

function findBatchRecord(batchId: string): MockBatchRecord {
  const record = readMockDatabase().batches.find((batch) => batch.batch.id === batchId);
  return record ?? throwMockNotFound("Batch", batchId);
}

async function parseUploadedFile(file: File) {
  try {
    return parseTransactionsCsv(await file.text(), { maxRows: MOCK_BATCH_ROW_CAP });
  } catch (error) {
    if (error instanceof CsvFormatError) {
      throw new ApiError({ kind: "validation", message: `Invalid transactions CSV: ${error.message}` });
    }
    throw error;
  }
}

function parseCursor(cursor: string | null): number {
  const offset = Number(cursor ?? 0);
  return Number.isInteger(offset) && offset >= 0 ? offset : 0;
}

/** Applies the run scope like the backend: `from` inclusive, `to` exclusive, then the first `limit` in time order. */
function selectScopedSeedTransactions({ from, to, limit }: RunScope): Transaction[] {
  const scopedTransactions = SEED_TRANSACTIONS.map(mapCsvRowToTransaction)
    .filter(({ bookedAt }) => (from === undefined || bookedAt >= from) && (to === undefined || bookedAt < to))
    .sort((left, right) => left.bookedAt.localeCompare(right.bookedAt));
  return scopedTransactions.slice(0, limit);
}

/** Evaluates the transactions with the active rules and stores the batch with a simulated processing window. */
function persistEvaluatedBatch({
  fileName,
  fileRowCount,
  transactions,
  uploadedBy,
}: {
  fileName: string;
  fileRowCount: number;
  transactions: Transaction[];
  uploadedBy: string;
}): Batch {
  const database = readMockDatabase();
  const ruleSnapshots = createRuleSnapshots(database);
  const rows = evaluateBatchRows(transactions, ruleSnapshots);
  const durationRatio = rows.length / MOCK_BATCH_ROW_CAP;

  const record: MockBatchRecord = {
    batch: {
      id: createMockId("batch"),
      fileName,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      fileRowCount,
      evaluatedRowCount: rows.length,
      activeRuleCount: ruleSnapshots.length,
      failureReason: null,
    },
    startedAtMs: Date.now(),
    durationMs: MIN_PROCESSING_MS + Math.round(durationRatio * MAX_EXTRA_PROCESSING_MS),
    ruleSnapshots,
  };
  writeBatchRows(record.batch.id, rows);
  writeMockDatabase({ ...database, batches: [...database.batches, record] });
  return mapBatchRecord(record);
}

export const mockBatchesService: BatchesService = {
  capabilities: { canUploadBatch: true, canStartRun: true },

  async loadBatches() {
    await simulateLatency();
    const nowMs = Date.now();
    const records = [...readMockDatabase().batches].reverse();
    return records.map((record) => mapBatchRecord(record, nowMs));
  },

  async loadBatch(batchId) {
    await simulateLatency({ minMs: 80, maxMs: 200 });
    return mapBatchRecord(findBatchRecord(batchId));
  },

  async uploadBatch({ file, uploadedBy }) {
    await simulateLatency();
    const parsedCsv = await parseUploadedFile(file);
    if (parsedCsv.rows.length === 0) {
      throw new ApiError({ kind: "validation", message: "The file contains no valid transaction rows." });
    }
    return persistEvaluatedBatch({
      fileName: file.name,
      fileRowCount: parsedCsv.fileRowCount,
      transactions: parsedCsv.rows.map(mapCsvRowToTransaction),
      uploadedBy,
    });
  },

  // Stands in for POST /evaluation-runs: the backend evaluates the transactions it already holds, the mock
  // evaluates the seed transactions with the current active rules.
  async startRun({ startedBy, scope }) {
    await simulateLatency();
    const transactions = selectScopedSeedTransactions(scope);
    if (transactions.length === 0) {
      throw new ApiError({ kind: "validation", message: "The run scope matches no transactions." });
    }
    return persistEvaluatedBatch({
      fileName: SEED_RUN_NAME,
      fileRowCount: transactions.length,
      transactions,
      uploadedBy: startedBy,
    });
  },

  async loadBatchTransactions({ batchId, bucket, cursor }) {
    await simulateLatency();
    const record = findBatchRecord(batchId);
    const processedRows = readBatchRows(batchId).slice(0, countProcessedRows(record, Date.now()));
    const bucketRows = processedRows.filter((row) => row.bucket === bucket);
    const offset = parseCursor(cursor);
    const nextOffset = offset + TRANSACTION_PAGE_SIZE;
    return {
      items: bucketRows.slice(offset, nextOffset),
      nextCursor: nextOffset < bucketRows.length ? String(nextOffset) : null,
      totalCount: bucketRows.length,
    };
  },

  async loadTransactionEvaluation({ batchId, transactionId }) {
    await simulateLatency();
    const record = findBatchRecord(batchId);
    const row = readBatchRows(batchId).find(
      (candidate) => candidate.transaction.transactionId === transactionId,
    );
    if (!row) {
      return throwMockNotFound("Transaction", transactionId);
    }
    // Results are recomputed from the batch's rule snapshot; the mock engine is deterministic, so they match.
    return { batchId, ...evaluateTransaction(row.transaction, record.ruleSnapshots) };
  },
};
