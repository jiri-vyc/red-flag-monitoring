import type {
  Batch,
  BatchTransactionPage,
  LoadBatchTransactionsInput,
  TransactionEvaluation,
} from "../types";

export interface BatchesService {
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
