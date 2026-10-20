"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { selectServiceImplementation } from "@/config/apiMode";
import { getCurrentUser } from "@/config/currentUser";
import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import type { RegulationsCapabilities } from "./contract";
import { regulationsImplementations, regulationsService } from "./service";

export const regulationQueryKeys = {
  all: ["regulations"] as const,
  detail: (regulationId: string) => ["regulations", regulationId] as const,
  // An object segment cannot collide with a regulation id; the `all` prefix still invalidates it.
  names: ["regulations", { view: "names" }] as const,
};

/** Follows the data source selected in the sidebar. */
export function useRegulationsCapabilities(): RegulationsCapabilities {
  const { apiMode } = useApiMode();
  return selectServiceImplementation("regulations", regulationsImplementations, apiMode).capabilities;
}

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

export function useDeleteRegulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (regulationId: string) =>
      regulationsService.deleteRegulation({ regulationId, deletedBy: getCurrentUser().name }),
    // The deleted regulation's own query is dropped, not refetched: a refetch would fail while its detail
    // navigates away, and a cached copy would show the deleted regulation again on browser Back.
    onSuccess: (_result, regulationId) => {
      queryClient.removeQueries({ queryKey: regulationQueryKeys.detail(regulationId) });
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: regulationQueryKeys.all,
          predicate: ({ queryKey }) => queryKey[1] !== regulationId,
        }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}
