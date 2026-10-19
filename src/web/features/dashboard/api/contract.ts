import type { DashboardSummary } from "../types";

export interface DashboardService {
  loadDashboardSummary(): Promise<DashboardSummary>;
}
