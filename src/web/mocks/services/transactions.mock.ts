import type { TransactionsService } from "@/features/transactions/api/contract";

import { mapCsvRowToTransaction } from "../evaluation/csvTransactions";
import { simulateLatency } from "../latency";
import { SEED_TRANSACTIONS } from "../seed/transactions";

const TRANSACTION_PAGE_SIZE = 50;

function parseCursor(cursor: string | null): number {
  const offset = Number(cursor ?? 0);
  return Number.isInteger(offset) && offset >= 0 ? offset : 0;
}

/** Filters and orders the seed transactions like the backend: newest first. */
export const mockTransactionsService: TransactionsService = {
  async loadTransactions({ clientId, cursor }) {
    await simulateLatency();
    const transactions = SEED_TRANSACTIONS.map(mapCsvRowToTransaction)
      .filter((transaction) => clientId === null || transaction.clientId === clientId)
      .sort(
        (left, right) =>
          right.bookedAt.localeCompare(left.bookedAt) ||
          right.transactionId.localeCompare(left.transactionId),
      );
    const offset = parseCursor(cursor);
    const nextOffset = offset + TRANSACTION_PAGE_SIZE;
    return {
      items: transactions.slice(offset, nextOffset),
      nextCursor: nextOffset < transactions.length ? String(nextOffset) : null,
      totalCount: transactions.length,
    };
  },
};
