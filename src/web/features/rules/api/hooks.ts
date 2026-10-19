"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { CURRENT_USER } from "@/config/currentUser";
import { assertUnreachable } from "@/lib/assertUnreachable";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import type { RuleAction } from "../domain/ruleLifecycle";
import type {
  AddWhitelistEntryInput,
  CreateManualRuleInput,
  CreateRuleVersionInput,
  RemoveWhitelistEntryInput,
  Rule,
  UpdateDraftContentInput,
} from "../types";
import { rulesService } from "./service";

export const ruleQueryKeys = {
  all: ["rules"] as const,
  detail: (ruleId: string) => ["rules", ruleId] as const,
  whitelist: (ruleId: string) => ["rules", ruleId, "whitelist"] as const,
};

export type RuleTransitionAction = Exclude<RuleAction, "create_version">;

// Rule changes affect counters and relations shown on other screens too.
function invalidateRuleRelatedQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ruleQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["policies"] }),
    queryClient.invalidateQueries({ queryKey: ["regulations"] }),
  ]);
}

function runRuleTransition({
  ruleId,
  action,
}: {
  ruleId: string;
  action: RuleTransitionAction;
}): Promise<Rule> {
  switch (action) {
    case "submit_for_review":
      return rulesService.submitRuleForReview(ruleId);
    case "approve":
      return rulesService.approveRule({ ruleId, reviewer: CURRENT_USER.name });
    case "reject":
      return rulesService.rejectRule({ ruleId, reviewer: CURRENT_USER.name });
    case "activate":
      return rulesService.activateRule(ruleId);
    case "deactivate":
      return rulesService.deactivateRule(ruleId);
    default:
      return assertUnreachable(action);
  }
}

export function useRules() {
  useServiceUsage("rules");
  return useQuery({ queryKey: ruleQueryKeys.all, queryFn: () => rulesService.loadRules() });
}

export function useRule(ruleId: string) {
  useServiceUsage("rules");
  return useQuery({ queryKey: ruleQueryKeys.detail(ruleId), queryFn: () => rulesService.loadRule(ruleId) });
}

export function useRuleTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runRuleTransition,
    onSuccess: () => invalidateRuleRelatedQueries(queryClient),
  });
}

export function useCreateManualRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateManualRuleInput) =>
      rulesService.createManualRule({ ...input, author: CURRENT_USER.name }),
    onSuccess: () => invalidateRuleRelatedQueries(queryClient),
  });
}

export function useCreateRuleVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRuleVersionInput) =>
      rulesService.createRuleVersion({ ...input, author: CURRENT_USER.name }),
    onSuccess: () => invalidateRuleRelatedQueries(queryClient),
  });
}

export function useUpdateDraftContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDraftContentInput) => rulesService.updateDraftContent(input),
    onSuccess: () => invalidateRuleRelatedQueries(queryClient),
  });
}

export function useRuleWhitelist(ruleId: string) {
  useServiceUsage("rules");
  return useQuery({
    queryKey: ruleQueryKeys.whitelist(ruleId),
    queryFn: () => rulesService.getWhitelist(ruleId),
  });
}

export function useAddWhitelistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddWhitelistEntryInput) =>
      rulesService.addWhitelistEntry({ ...input, author: CURRENT_USER.name }),
    onSuccess: (_entry, input) =>
      queryClient.invalidateQueries({ queryKey: ruleQueryKeys.whitelist(input.ruleId) }),
  });
}

export function useRemoveWhitelistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RemoveWhitelistEntryInput) => rulesService.removeWhitelistEntry(input),
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({ queryKey: ruleQueryKeys.whitelist(input.ruleId) }),
  });
}
