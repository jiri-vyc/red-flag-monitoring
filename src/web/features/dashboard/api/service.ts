import { resolveService } from "@/config/apiMode";
import { mockDashboardService } from "@/mocks/services/dashboard.mock";

import type { DashboardService } from "./contract";
import { liveDashboardService } from "./live";

export const dashboardService = resolveService<DashboardService>("dashboard", {
  mock: mockDashboardService,
  live: liveDashboardService,
});
