import { resolveService, type ServiceImplementations } from "@/config/apiMode";
import { mockFauReportsService } from "@/mocks/services/fauReports.mock";

import type { FauReportsService } from "./contract";
import { liveFauReportsService } from "./live";

export const fauReportsImplementations: ServiceImplementations<FauReportsService> = {
  mock: mockFauReportsService,
  live: liveFauReportsService,
};

export const fauReportsService = resolveService("fauReports", fauReportsImplementations);
