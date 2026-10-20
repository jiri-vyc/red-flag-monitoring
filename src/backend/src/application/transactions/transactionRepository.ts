import type { Transaction } from "../../domain/transaction";
import type { Page, PageRequest } from "../pagination";

// A null field does not filter. from / to are local timestamps ("YYYY-MM-DDTHH:MM:SS"), from inclusive, to exclusive.
export type TransactionFilter = {
  clientId: string | null;
  from: string | null;
  to: string | null;
};

export interface TransactionRepository {
  // Newest first.
  listTransactions(filter: TransactionFilter, page: PageRequest): Promise<Page<Transaction>>;
}
