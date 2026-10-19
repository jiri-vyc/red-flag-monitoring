import type {
  Batch,
  BatchTransactionPage,
  LoadBatchTransactionsInput,
  TransactionEvaluation,
} from "../types";

/** What the active implementation supports. The UI hides actions that are false instead of letting them fail. */
export type BatchesCapabilities = {
  /** Upload a transactions CSV, which creates a batch (evaluation run) and starts its evaluation. */
  canUploadBatch: boolean;
};

export interface BatchesService {
  readonly capabilities: BatchesCapabilities;
  loadBatches(): Promise<Batch[]>;
  loadBatch(batchId: string): Promise<Batch>;
  /** Every upload creates a new batch, even for an identical file. Evaluation starts immediately. */
  uploadBatch(input: { file: File; uploadedBy: string }): Promise<Batch>;
  loadBatchTransactions(input: LoadBatchTransactionsInput): Promise<BatchTransactionPage>;
  loadTransactionEvaluation(input: {
    batchId: string;
    transactionId: string;
  }): Promise<TransactionEvaluation>;
}
