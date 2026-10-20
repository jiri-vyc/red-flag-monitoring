import type { Transaction } from "../../domain/transaction";
import type { Page, PageRequest } from "../pagination";
import type { TransactionFilter, TransactionRepository } from "./transactionRepository";

// Issue #9: read-only list of a client's transactions, the data behind a rule's trace.
export class TransactionQueries {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  listTransactions(filter: TransactionFilter, page: PageRequest): Promise<Page<Transaction>> {
    return this.transactionRepository.listTransactions(filter, page);
  }
}
