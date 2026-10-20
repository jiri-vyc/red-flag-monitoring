import type { RuleReviewReport, RuleReviewSummary } from "../types";

export type RuleReviewsCapabilities = {
  canStartReview: boolean;
};

export interface RuleReviewsService {
  readonly capabilities: RuleReviewsCapabilities;
  loadReviews(): Promise<RuleReviewSummary[]>;
  loadReview(reviewId: string): Promise<RuleReviewReport>;
  startReview(input: { startedBy: string }): Promise<RuleReviewReport>;
}
