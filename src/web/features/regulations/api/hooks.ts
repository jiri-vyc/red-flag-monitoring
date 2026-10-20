"use client";

import { useQuery } from "@tanstack/react-query";

import { useServiceUsage } from "@/providers/MockUsageProvider";

import { regulationsService } from "./service";

export const regulationQueryKeys = {
  all: ["regulations"] as const,
  detail: (regulationId: string) => ["regulations", regulationId] as const,
  // An object segment cannot collide with a regulation id; the `all` prefix still invalidates it.
  names: ["regulations", { view: "names" }] as const,
};

export function useRegulations() {
  useServiceUsage("regulations");
  return useQuery({ queryKey: regulationQueryKeys.all, queryFn: () => regulationsService.loadRegulations() });
}

/** Short names by regulation id, for links that must not load the full regulation list. */
export function useRegulationNames() {
  useServiceUsage("regulations");
  return useQuery({
    queryKey: regulationQueryKeys.names,
    queryFn: () => regulationsService.loadRegulationNames(),
  });
}

export function useRegulation(regulationId: string) {
  useServiceUsage("regulations");
  return useQuery({
    queryKey: regulationQueryKeys.detail(regulationId),
    queryFn: () => regulationsService.loadRegulation(regulationId),
  });
}
