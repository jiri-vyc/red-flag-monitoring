import { Router } from "express";
import { z } from "zod";

import type { TransactionQueries } from "../../application/transactions/transactionQueries";
import { CLIENT_ID_PATTERN, localTimestampSchema, pageQuerySchema } from "./schemas";
import { parseRequest } from "./validation";

const transactionListQuerySchema = pageQuerySchema
  .extend({
    clientId: z
      .string()
      .regex(CLIENT_ID_PATTERN)
      .optional()
      .transform((value) => value ?? null),
    from: localTimestampSchema,
    to: localTimestampSchema,
  })
  .refine((query) => !query.from || !query.to || query.from < query.to, {
    message: "from must be before to",
  });

export function createTransactionsRouter(transactionQueries: TransactionQueries): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    const { clientId, from, to, limit, offset } = parseRequest(transactionListQuerySchema, request.query);

    response.json(await transactionQueries.listTransactions({ clientId, from, to }, { limit, offset }));
  });

  return router;
}
