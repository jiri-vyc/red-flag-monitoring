"use client";

import { useQuery } from "@tanstack/react-query";

import { useServiceUsage } from "@/providers/MockUsageProvider";

import { dashboardService } from "./service";

export function useDashboardSummary() {
  // The live summary reads the live endpoints directly, so only the dashboard's own mode decides about mock data.
  useServiceUsage("dashboard");
  return useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardService.loadDashboardSummary() });
}
