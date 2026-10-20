"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { getCurrentUser } from "@/config/currentUser";
import { assertUnreachable } from "@/lib/assertUnreachable";
import { selectServiceImplementation } from "@/config/apiMode";
import { useApiMode } from "@/providers/ApiModeProvider";
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
import type { RulesCapabilities } from "./contract";
import { rulesImplementations, rulesService } from "./service";
import type { UserRole } from "@/features/users/types";

export const ruleQueryKeys = {
  all: ["rules"] as const,
  detail: (ruleId: string) => ["rules", ruleId] as const,
  whitelist: (ruleId: string) => ["rules", ruleId, "whitelist"] as const,
};

// A rejection needs a reason, so it has its own mutation (useRejectRule).
export type RuleTransitionAction = Exclude<RuleAction, "create_version" | "reject">;

// Rule changes affect counters and relations shown on other screens too.
function invalidateRuleDependentQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["policies"] }),
    queryClient.invalidateQueries({ queryKey: ["regulations"] }),
  ]);
}

function invalidateRuleRelatedQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ruleQueryKeys.all }),
    invalidateRuleDependentQueries(queryClient),
  ]);
}

function runRuleTransition({
  ruleId,
  action,
  escalationRole = null,
}: {
  ruleId: string;
  action: RuleTransitionAction;
  /** Only for approve: the escalation role picked at review (issue #6); null keeps the version's role. */
  escalationRole?: UserRole | null;
}): Promise<Rule> {
  switch (action) {
    case "submit_for_review":
      return rulesService.submitRuleForReview(ruleId);
    case "approve":
      return rulesService.approveRule({ ruleId, reviewer: getCurrentUser().name, escalationRole });
    case "activate":
      return rulesService.activateRule(ruleId);
    case "deactivate":
      return rulesService.deactivateRule(ruleId);
    default:
      return assertUnreachable(action);
  }
}

/** Follows the data source selected in the sidebar. */
export function useRulesCapabilities(): RulesCapabilities {
  const { apiMode } = useApiMode();
  return selectServiceImplementation("rules", rulesImplementations, apiMode).capabilities;
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

export function useRejectRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ruleId,
      comment,
      escalationRole = null,
    }: {
      ruleId: string;
      comment: string;
      escalationRole?: UserRole | null;
    }) => rulesService.rejectRule({ ruleId, comment, reviewer: getCurrentUser().name, escalationRole }),
    onSuccess: () => invalidateRuleRelatedQueries(queryClient),
  });
}

export function useCreateManualRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateManualRuleInput) =>
      rulesService.createManualRule({ ...input, author: getCurrentUser().name }),
    onSuccess: () => invalidateRuleRelatedQueries(queryClient),
  });
}

export function useCreateRuleVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRuleVersionInput) =>
      rulesService.createRuleVersion({ ...input, author: getCurrentUser().name }),
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

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => rulesService.deleteRule({ ruleId, deletedBy: getCurrentUser().name }),
    // The deleted rule's own queries (detail, whitelist) are dropped, not refetched: a refetch would fail while
    // its detail navigates away, and a cached copy would show the deleted rule again on browser Back.
    onSuccess: (_result, ruleId) => {
      queryClient.removeQueries({ queryKey: ruleQueryKeys.detail(ruleId) });
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ruleQueryKeys.all,
          predicate: ({ queryKey }) => queryKey[1] !== ruleId,
        }),
        invalidateRuleDependentQueries(queryClient),
      ]);
    },
  });
}

/** `enabled: false` for a rule that does not allow a whitelist, so its entries are not fetched. */
export function useRuleWhitelist(ruleId: string, { enabled }: { enabled: boolean }) {
  useServiceUsage("rules");
  return useQuery({
    queryKey: ruleQueryKeys.whitelist(ruleId),
    queryFn: () => rulesService.getWhitelist(ruleId),
    enabled,
  });
}

export function useAddWhitelistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddWhitelistEntryInput) =>
      rulesService.addWhitelistEntry({ ...input, author: getCurrentUser().name }),
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
