"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { selectServiceImplementation } from "@/config/apiMode";
import { getCurrentUser } from "@/config/currentUser";
import { useApiMode } from "@/providers/ApiModeProvider";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import type { RuleReviewReport, RuleReviewSummary } from "../types";
import type { RuleReviewsCapabilities } from "./contract";
import { ruleReviewsImplementations, ruleReviewsService } from "./service";

const RUNNING_POLL_INTERVAL_MS = 2000;

export const ruleReviewQueryKeys = {
  all: ["ruleReviews"] as const,
  detail: (reviewId: string) => ["ruleReviews", reviewId] as const,
};

export function findRunningPollInterval(
  reviews: Pick<RuleReviewSummary, "status">[] | undefined,
): number | false {
  return reviews?.some((review) => review.status === "running") ? RUNNING_POLL_INTERVAL_MS : false;
}

export function useRuleReviews() {
  useServiceUsage("rules");
  return useQuery({
    queryKey: ruleReviewQueryKeys.all,
    queryFn: () => ruleReviewsService.loadReviews(),
    refetchInterval: (query) => findRunningPollInterval(query.state.data),
  });
}

export function useRuleReview(reviewId: string | null) {
  useServiceUsage("rules");
  return useQuery({
    queryKey: ruleReviewQueryKeys.detail(reviewId ?? ""),
    queryFn: () => ruleReviewsService.loadReview(reviewId ?? ""),
    enabled: reviewId !== null,
    refetchInterval: (query) => findRunningPollInterval(query.state.data && [query.state.data]),
  });
}

export function useStartRuleReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ruleReviewsService.startReview({ startedBy: getCurrentUser().id }),
    onSuccess: (report: RuleReviewReport) => {
      queryClient.setQueryData(ruleReviewQueryKeys.detail(report.id), report);
      return queryClient.invalidateQueries({ queryKey: ruleReviewQueryKeys.all });
    },
  });
}

export function useRuleReviewsCapabilities(): RuleReviewsCapabilities {
  const { apiMode } = useApiMode();
  return selectServiceImplementation("rules", ruleReviewsImplementations, apiMode).capabilities;
}
