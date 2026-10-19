"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { draftingJobsService } from "@/features/draftingJobs/api/service";
import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import type { DraftPoliciesInput } from "../types";
import { resumeWizardRun } from "../wizardRun";
import type { WizardCapabilities } from "./contract";
import { getWizardCapabilities, wizardService } from "./service";

/** Follows the data source selected in the sidebar. */
export function useWizardCapabilities(): WizardCapabilities {
  const { apiMode } = useApiMode();
  return getWizardCapabilities(apiMode);
}

// The wizard writes regulations, policies, rules and drafting jobs, which every screen except batches shows.
function useInvalidateGeneratedArtifacts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "batches" });
}

// The step state is copied out of these queries once, so a cached, older answer must never be served again.
const UNCACHED_QUERY = { staleTime: 0, gcTime: 0 } as const;

export function useWizardRun(jobId: string) {
  useServiceUsage("wizard");
  return useQuery({
    queryKey: ["wizard", "run", jobId],
    queryFn: () => resumeWizardRun(jobId, { wizard: wizardService, draftingJobs: draftingJobsService }),
    ...UNCACHED_QUERY,
  });
}

export function useDraftedRules(policyIds: string[], { enabled }: { enabled: boolean }) {
  useServiceUsage("wizard");
  return useQuery({
    queryKey: ["wizard", "drafted-rules", policyIds],
    queryFn: () => wizardService.loadDraftedRules(policyIds),
    enabled,
    ...UNCACHED_QUERY,
  });
}

export function useStartPolicyDrafting() {
  useServiceUsage("wizard");
  const invalidateGeneratedArtifacts = useInvalidateGeneratedArtifacts();
  return useMutation({
    mutationFn: (input: DraftPoliciesInput) => wizardService.startPolicyDrafting(input),
    onSuccess: invalidateGeneratedArtifacts,
  });
}

export function useApprovePolicyDraft() {
  useServiceUsage("wizard");
  const invalidateGeneratedArtifacts = useInvalidateGeneratedArtifacts();
  return useMutation({
    mutationFn: (policyId: string) => wizardService.approvePolicyDraft(policyId),
    onSuccess: invalidateGeneratedArtifacts,
  });
}

export function useFinishRuleReview() {
  useServiceUsage("wizard");
  const invalidateGeneratedArtifacts = useInvalidateGeneratedArtifacts();
  return useMutation({
    mutationFn: (policyIds: string[]) => wizardService.finishRuleReview(policyIds),
    onSuccess: invalidateGeneratedArtifacts,
  });
}
