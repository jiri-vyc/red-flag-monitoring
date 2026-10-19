import { z } from "zod";

import { batchSchema } from "@/features/batches/types";
import { ruleSchema } from "@/features/rules/types";

export const dashboardSummarySchema = z.object({
  activeRuleCount: z.number(),
  rulesAwaitingReviewCount: z.number(),
  regulationCount: z.number(),
  policyCount: z.number(),
  recentBatches: z.array(batchSchema),
  rulesNeedingReview: z.array(ruleSchema),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
