import { requestJson } from "@/lib/httpClient";

import type { RuleReviewsService } from "./contract";
import { ruleReviewListDtoSchema, ruleReviewReportDtoSchema, type StartRuleReviewBodyDto } from "./dto";

const reviewPath = (reviewId: string) => `/rule-reviews/${encodeURIComponent(reviewId)}`;

export const liveRuleReviewsService: RuleReviewsService = {
  capabilities: { canStartReview: true },

  loadReviews: () => requestJson({ path: "/rule-reviews", schema: ruleReviewListDtoSchema }),

  loadReview: (reviewId) => requestJson({ path: reviewPath(reviewId), schema: ruleReviewReportDtoSchema }),

  startReview: ({ startedBy }) => {
    const body: StartRuleReviewBodyDto = { createdBy: startedBy };
    return requestJson({
      path: "/rule-reviews",
      method: "POST",
      jsonBody: body,
      schema: ruleReviewReportDtoSchema,
    });
  },
};
