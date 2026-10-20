import { z } from "zod";

import { transactionViewSchema } from "@/features/batches/types";

/** Same format as the backend filter (`^K[0-9]{6}$`); the page checks it before it sends the request. */
export const CLIENT_ID_PATTERN = /^K[0-9]{6}$/;

/** Issue #9: a page of transactions, newest first. The list has no rule results, so no CZK amount in live mode. */
export const transactionListPageSchema = z.object({
  items: z.array(transactionViewSchema),
  nextCursor: z.string().nullable(),
  totalCount: z.number(),
});
export type TransactionListPage = z.infer<typeof transactionListPageSchema>;

/** A null client lists every transaction. */
export type LoadTransactionsInput = { clientId: string | null; cursor: string | null };
