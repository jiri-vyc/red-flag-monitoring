"use client";

import { useQuery } from "@tanstack/react-query";

import { useServiceUsage } from "@/providers/MockUsageProvider";

import { dashboardService } from "./service";

export function useDashboardSummary() {
  useServiceUsage("dashboard");
  return useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardService.loadDashboardSummary() });
}
