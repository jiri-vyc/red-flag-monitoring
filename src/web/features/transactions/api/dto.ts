import { z } from "zod";

import { transactionDtoSchema } from "@/features/batches/api/dto";

// Response DTO of GET /api/transactions (src/backend/src/delivery/http/transactionsRouter.ts).
export const transactionPageDtoSchema = z.object({
  items: z.array(transactionDtoSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});
