/** The backend's transaction types (src/backend/src/domain/transaction.ts, TRANSACTION_TYPES). */
export const TRANSACTION_TYPES = ["outgoing", "incoming", "remittance"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// Mock data and uploaded CSVs keep the dataset spelling; the backend normalises it when loading (LoadDatasets).
const DATASET_TRANSACTION_TYPES: Record<string, TransactionType> = {
  "outgoing payment": "outgoing",
  "incoming payment": "incoming",
};

function isTransactionType(value: string): value is TransactionType {
  return TRANSACTION_TYPES.some((transactionType) => transactionType === value);
}

/** The known type of a raw value from either source; null for a value the web does not know. */
export function toTransactionType(value: string): TransactionType | null {
  if (isTransactionType(value)) {
    return value;
  }
  return DATASET_TRANSACTION_TYPES[value] ?? null;
}

/** The translated label of a known type; an unknown value is shown as it came. */
export function formatTransactionType(value: string, labels: Record<TransactionType, string>): string {
  const transactionType = toTransactionType(value);
  return transactionType === null ? value : labels[transactionType];
}
