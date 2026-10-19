export const TRANSACTION_TYPES = ["outgoing", "incoming", "remittance"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
