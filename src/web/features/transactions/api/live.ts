import { toTransactionView } from "@/features/batches/api/dto";
import { requestJson } from "@/lib/httpClient";

import type { TransactionsService } from "./contract";
import { transactionPageDtoSchema } from "./dto";

const TRANSACTION_PAGE_SIZE = 50;

export const liveTransactionsService: TransactionsService = {
  async loadTransactions({ clientId, cursor }) {
    const searchParams = new URLSearchParams({
      limit: String(TRANSACTION_PAGE_SIZE),
      offset: cursor ?? "0",
      ...(clientId !== null && { clientId }),
    });
    const page = await requestJson({
      path: `/transactions?${searchParams.toString()}`,
      schema: transactionPageDtoSchema,
    });
    const nextOffset = page.offset + page.items.length;
    return {
      // The CZK amount is not a transaction column; only rule results carry it.
      items: page.items.map((transaction) => toTransactionView(transaction, null)),
      nextCursor: nextOffset < page.total ? String(nextOffset) : null,
      totalCount: page.total,
    };
  },
};
