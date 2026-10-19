"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import type { GeneratePolicyInput } from "../types";
import type { WizardCapabilities } from "./contract";
import { getWizardCapabilities, wizardService } from "./service";

/** Follows the data source selected in the sidebar. */
export function useWizardCapabilities(): WizardCapabilities {
  const { apiMode } = useApiMode();
  return getWizardCapabilities(apiMode);
}

function useInvalidateGeneratedArtifacts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "batches" });
}

export function useGeneratePolicyDraft() {
  useServiceUsage("wizard");
  const invalidateGeneratedArtifacts = useInvalidateGeneratedArtifacts();
  return useMutation({
    mutationFn: (input: GeneratePolicyInput) => wizardService.generatePolicyDraft(input),
    onSuccess: invalidateGeneratedArtifacts,
  });
}

export function useGenerateRules() {
  useServiceUsage("wizard");
  const invalidateGeneratedArtifacts = useInvalidateGeneratedArtifacts();
  return useMutation({
    mutationFn: (policyId: string) => wizardService.generateRules(policyId),
    onSuccess: invalidateGeneratedArtifacts,
  });
}

export function useFinishRuleReview() {
  useServiceUsage("wizard");
  const invalidateGeneratedArtifacts = useInvalidateGeneratedArtifacts();
  return useMutation({
    mutationFn: (policyId: string) => wizardService.finishRuleReview(policyId),
    onSuccess: invalidateGeneratedArtifacts,
  });
}
