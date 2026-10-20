"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { getCurrentUser } from "@/config/currentUser";
import { draftingJobQueryKeys } from "@/features/draftingJobs/api/hooks";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import type { UpdatePolicyTextInput } from "../types";
import { policiesService } from "./service";

export const policyQueryKeys = {
  all: ["policies"] as const,
  detail: (policyId: string) => ["policies", policyId] as const,
  // An object segment cannot collide with a policy id; the `all` prefix still invalidates it.
  names: ["policies", { view: "names" }] as const,
};

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
