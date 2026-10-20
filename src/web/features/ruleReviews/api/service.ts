import { resolveService, type ServiceImplementations } from "@/config/apiMode";
import { mockRuleReviewsService } from "@/mocks/services/ruleReviews.mock";

import type { RuleReviewsService } from "./contract";
import { liveRuleReviewsService } from "./live";

export const ruleReviewsImplementations: ServiceImplementations<RuleReviewsService> = {
  mock: mockRuleReviewsService,
  live: liveRuleReviewsService,
};

export const ruleReviewsService = resolveService("rules", ruleReviewsImplementations);
