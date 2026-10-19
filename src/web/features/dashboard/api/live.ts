import { requestJson } from "@/lib/httpClient";

import { dashboardSummarySchema } from "../types";
import type { DashboardService } from "./contract";

export const liveDashboardService: DashboardService = {
  loadDashboardSummary: () => requestJson({ path: "/dashboard", schema: dashboardSummarySchema }),
};
