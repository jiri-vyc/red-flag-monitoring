import { resolveService, type ServiceImplementations } from "@/config/apiMode";
import { mockBatchesService } from "@/mocks/services/batches.mock";

import type { BatchesService } from "./contract";
import { liveBatchesService } from "./live";

export const batchesImplementations: ServiceImplementations<BatchesService> = {
  mock: mockBatchesService,
  live: liveBatchesService,
};

export const batchesService = resolveService("batches", batchesImplementations);
