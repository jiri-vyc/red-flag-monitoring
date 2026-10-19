"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import type { DraftPoliciesInput } from "../types";
import type { WizardCapabilities } from "./contract";
import { getWizardCapabilities, wizardService } from "./service";

/** Follows the data source selected in the sidebar. */
export function useWizardCapabilities(): WizardCapabilities {
  const { apiMode } = useApiMode();
  return getWizardCapabilities(apiMode);
}

// The wizard writes regulations, policies and rules, which every screen except batches shows.
function useInvalidateGeneratedArtifacts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "batches" });
}

export function useDraftPolicies() {
  useServiceUsage("wizard");
  const invalidateGeneratedArtifacts = useInvalidateGeneratedArtifacts();
  return useMutation({
    mutationFn: (input: DraftPoliciesInput) => wizardService.draftPolicies(input),
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
