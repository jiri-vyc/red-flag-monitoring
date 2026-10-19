"use client";

import { useQuery } from "@tanstack/react-query";

import { useServiceUsage } from "@/providers/MockUsageProvider";

import { regulationsService } from "./service";

export const regulationQueryKeys = {
  all: ["regulations"] as const,
  detail: (regulationId: string) => ["regulations", regulationId] as const,
};

export function useRegulations() {
  useServiceUsage("regulations");
  return useQuery({ queryKey: regulationQueryKeys.all, queryFn: () => regulationsService.loadRegulations() });
}

export function useRegulation(regulationId: string) {
  useServiceUsage("regulations");
  return useQuery({
    queryKey: regulationQueryKeys.detail(regulationId),
    queryFn: () => regulationsService.loadRegulation(regulationId),
  });
}
