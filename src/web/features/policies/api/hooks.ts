"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { selectServiceImplementation } from "@/config/apiMode";
import { getCurrentUser } from "@/config/currentUser";
import { draftingJobQueryKeys } from "@/features/draftingJobs/api/hooks";
import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import type { UpdatePolicyTextInput } from "../types";
import type { PoliciesCapabilities } from "./contract";
import { policiesImplementations, policiesService } from "./service";

export const policyQueryKeys = {
  all: ["policies"] as const,
  detail: (policyId: string) => ["policies", policyId] as const,
  // An object segment cannot collide with a policy id; the `all` prefix still invalidates it.
  names: ["policies", { view: "names" }] as const,
};

/** Follows the data source selected in the sidebar. */
export function usePoliciesCapabilities(): PoliciesCapabilities {
  const { apiMode } = useApiMode();
  return selectServiceImplementation("policies", policiesImplementations, apiMode).capabilities;
}

export function usePolicies() {
  useServiceUsage("policies");
  return useQuery({ queryKey: policyQueryKeys.all, queryFn: () => policiesService.loadPolicies() });
}

/** Names by policy id, for links that must not load the full policy list. */
export function usePolicyNames() {
  useServiceUsage("policies");
  return useQuery({ queryKey: policyQueryKeys.names, queryFn: () => policiesService.loadPolicyNames() });
}

export function usePolicy(policyId: string) {
  useServiceUsage("policies");
  return useQuery({
    queryKey: policyQueryKeys.detail(policyId),
    queryFn: () => policiesService.loadPolicy(policyId),
  });
}

export function useUpdatePolicyText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePolicyTextInput) => policiesService.updatePolicyText(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: policyQueryKeys.all }),
  });
}

// Approval starts a rules job, whose drafts then change rule lists, counters and regulation citations too.
function invalidatePolicyApprovalQueries(queryClient: QueryClient) {
  return Promise.all(
    [policyQueryKeys.all, ["rules"], ["dashboard"], ["regulations"], draftingJobQueryKeys.all].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useApprovePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: string) =>
      policiesService.approvePolicy({ policyId, approvedBy: getCurrentUser().name }),
    onSuccess: () => invalidatePolicyApprovalQueries(queryClient),
  });
}

// A rejection starts no rules job, but invalidating the same caches as approval keeps every screen in step.
export function useRejectPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ policyId, reason }: { policyId: string; reason: string }) =>
      policiesService.rejectPolicy({ policyId, rejectedBy: getCurrentUser().name, reason }),
    onSuccess: () => invalidatePolicyApprovalQueries(queryClient),
  });
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: string) =>
      policiesService.deletePolicy({ policyId, deletedBy: getCurrentUser().name }),
    // The deleted policy's own query is dropped, not refetched: a refetch would fail while its detail navigates
    // away, and a cached copy would show the deleted policy again on browser Back.
    // Regulations list the policies citing them, the dashboard counts policies.
    onSuccess: (_result, policyId) => {
      queryClient.removeQueries({ queryKey: policyQueryKeys.detail(policyId) });
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: policyQueryKeys.all,
          predicate: ({ queryKey }) => queryKey[1] !== policyId,
        }),
        queryClient.invalidateQueries({ queryKey: ["regulations"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}
