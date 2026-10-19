import { resolveService, type ServiceImplementations } from "@/config/apiMode";
import { mockRegulationsService } from "@/mocks/services/regulations.mock";

import type { RegulationsService } from "./contract";
import { liveRegulationsService } from "./live";

export const regulationsImplementations: ServiceImplementations<RegulationsService> = {
  mock: mockRegulationsService,
  live: liveRegulationsService,
};

export const regulationsService = resolveService("regulations", regulationsImplementations);
