import type { LoadTransactionsInput, TransactionListPage } from "../types";

export interface TransactionsService {
  loadTransactions(input: LoadTransactionsInput): Promise<TransactionListPage>;
}
