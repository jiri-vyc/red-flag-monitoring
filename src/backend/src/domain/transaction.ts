export const TRANSACTION_TYPES = ["outgoing", "incoming", "remittance"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// Amounts stay decimal strings so numeric(14, 2) values keep their precision.
export type Transaction = {
  transactionId: string;
  clientId: string;
  occurredAt: Date;
  amount: string;
  currency: string;
  payerCountry: string;
  payeeCountry: string;
  payerAccount: string | null;
  payeeAccount: string;
  transactionType: TransactionType;
  counterpartyAccount: string | null;
  counterpartyCountry: string | null;
};
