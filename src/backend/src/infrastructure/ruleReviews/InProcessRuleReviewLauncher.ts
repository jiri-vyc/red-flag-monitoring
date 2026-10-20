import type { RuleReviewExecutor } from "../../application/ruleReviews/ruleReviewExecutor";
import type { RuleReviewLauncher } from "../../application/ruleReviews/ruleReviewPorts";

export class InProcessRuleReviewLauncher implements RuleReviewLauncher {
  constructor(private readonly ruleReviewExecutor: RuleReviewExecutor) {}

  launchReview(reviewId: string): Promise<void> {
    // Detached on purpose: the executor records failures in the report.
    setImmediate(() => {
      this.ruleReviewExecutor.executeReview(reviewId).catch((error: unknown) => {
        console.error(`Rule review ${reviewId} failed`, error);
      });
    });

    return Promise.resolve();
  }
}
