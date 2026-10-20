import { resolveService, type ServiceImplementations } from "@/config/apiMode";
import { mockTransactionsService } from "@/mocks/services/transactions.mock";

import type { TransactionsService } from "./contract";
import { liveTransactionsService } from "./live";

export const transactionsImplementations: ServiceImplementations<TransactionsService> = {
  mock: mockTransactionsService,
  live: liveTransactionsService,
};

export const transactionsService = resolveService("transactions", transactionsImplementations);
