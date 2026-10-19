import { resolveService } from "@/config/apiMode";
import { mockBatchesService } from "@/mocks/services/batches.mock";

import type { BatchesService } from "./contract";
import { liveBatchesService } from "./live";

export const batchesService = resolveService<BatchesService>("batches", {
  mock: mockBatchesService,
  live: liveBatchesService,
});
