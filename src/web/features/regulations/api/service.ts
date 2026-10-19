import { resolveService } from "@/config/apiMode";
import { mockRegulationsService } from "@/mocks/services/regulations.mock";

import type { RegulationsService } from "./contract";
import { liveRegulationsService } from "./live";

export const regulationsService = resolveService<RegulationsService>("regulations", {
  mock: mockRegulationsService,
  live: liveRegulationsService,
});
