import { liveBatchesService } from "@/features/batches/api/live";
import { fetchPolicyDtos } from "@/features/policies/api/dto";
import { fetchRegulationDtos } from "@/features/regulations/api/dto";
import { liveRulesService } from "@/features/rules/api/live";
import type { RuleStatus } from "@/features/rules/types";

import type { DashboardService } from "./contract";

const RECENT_BATCH_COUNT = 3;
const REVIEW_STATUSES: ReadonlySet<RuleStatus> = new Set(["pending_for_review", "update_for_review"]);

/**
 * The backend has no dashboard endpoint, so the summary is composed from the live endpoints.
 * It uses the live adapters directly, never the resolved services, so a live dashboard never mixes in mock data
 * and every link points to a live id. Regulations and policies are only counted, so their versions are not loaded.
 */
export const liveDashboardService: DashboardService = {
  async loadDashboardSummary() {
    const [rules, regulations, policies, batches] = await Promise.all([
      liveRulesService.loadRules(),
      fetchRegulationDtos(),
      fetchPolicyDtos(),
      liveBatchesService.loadBatches(),
    ]);
    const rulesNeedingReview = rules.filter((rule) => REVIEW_STATUSES.has(rule.status));
    return {
      activeRuleCount: rules.filter((rule) => rule.status === "active").length,
      rulesAwaitingReviewCount: rulesNeedingReview.length,
      regulationCount: regulations.length,
      policyCount: policies.length,
      // GET /evaluation-runs lists the newest run first.
      recentBatches: batches.slice(0, RECENT_BATCH_COUNT),
      rulesNeedingReview,
    };
  },
};
