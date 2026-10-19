import type { DashboardService } from "@/features/dashboard/api/contract";

import { simulateLatency } from "../latency";
import { readMockDatabase } from "../store/mockDatabase";
import { mapBatchRecord } from "./batchState";

const RECENT_BATCH_COUNT = 3;
const REVIEW_STATUSES = new Set(["pending_for_review", "update_for_review"]);

export const mockDashboardService: DashboardService = {
  async loadDashboardSummary() {
    await simulateLatency();
    const database = readMockDatabase();
    const rulesNeedingReview = database.rules.filter((rule) => REVIEW_STATUSES.has(rule.status));
    const recentBatches = database.batches
      .slice(-RECENT_BATCH_COUNT)
      .reverse()
      .map((record) => mapBatchRecord(record));
    return {
      activeRuleCount: database.rules.filter((rule) => rule.status === "active").length,
      rulesAwaitingReviewCount: rulesNeedingReview.length,
      regulationCount: database.regulations.length,
      policyCount: database.policies.length,
      recentBatches,
      rulesNeedingReview,
    };
  },
};
