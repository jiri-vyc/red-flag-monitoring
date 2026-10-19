import { resolveService, type ServiceImplementations } from "@/config/apiMode";
import { mockDashboardService } from "@/mocks/services/dashboard.mock";

import type { DashboardService } from "./contract";
import { liveDashboardService } from "./live";

export const dashboardImplementations: ServiceImplementations<DashboardService> = {
  mock: mockDashboardService,
  live: liveDashboardService,
};

export const dashboardService = resolveService("dashboard", dashboardImplementations);
