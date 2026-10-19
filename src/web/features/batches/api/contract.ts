import type {
  Batch,
  BatchTransactionPage,
  LoadBatchTransactionsInput,
  RunScope,
  TransactionEvaluation,
} from "../types";
import type { UserRole } from "@/features/users/types";

/** What the active implementation supports. The UI hides actions that are false instead of letting them fail. */
export type BatchesCapabilities = {
  /** Upload a transactions CSV, which creates a batch (evaluation run) and starts its evaluation. */
  canUploadBatch: boolean;
  /** Start an evaluation run of the active rules over the transactions already in the system. */
  canStartRun: boolean;
};

export interface BatchesService {
  readonly capabilities: BatchesCapabilities;
  loadBatches(): Promise<Batch[]>;
  loadBatch(batchId: string): Promise<Batch>;
  /** Every upload creates a new batch, even for an identical file. Evaluation starts immediately. */
  uploadBatch(input: { file: File; uploadedBy: string }): Promise<Batch>;
  /** Starts a new evaluation run (a batch) with the active enabled rules; it is `processing` until it finishes. */
  startRun(input: { startedBy: string; scope: RunScope }): Promise<Batch>;
  loadBatchTransactions(input: LoadBatchTransactionsInput): Promise<BatchTransactionPage>;
  /** Failed rules list only hits escalated to `role` (issue #6). */
  loadTransactionEvaluation(input: {
    batchId: string;
    transactionId: string;
    role: UserRole;
  }): Promise<TransactionEvaluation>;
}
