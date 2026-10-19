import { resolveService, type ServiceImplementations } from "@/config/apiMode";
import { mockDraftingJobsService } from "@/mocks/services/draftingJobs.mock";

import type { DraftingJobsService } from "./contract";
import { liveDraftingJobsService } from "./live";

// Must follow the wizard's data source: a job points to the regulations, policies and rules the wizard writes.
export const draftingJobsImplementations: ServiceImplementations<DraftingJobsService> = {
  mock: mockDraftingJobsService,
  live: liveDraftingJobsService,
};

export const draftingJobsService = resolveService("wizard", draftingJobsImplementations);
