import { ConflictError } from "../errors";
import type { RuleReviewReportStore } from "../ruleReviews/ruleReviewPorts";
import { isFinishedReview, type RuleReviewReport } from "../../domain/ruleReview/ruleReviewReport";

export class InMemoryRuleReviewReportStore implements RuleReviewReportStore {
  readonly reports = new Map<string, RuleReviewReport>();
  readonly savedStages: string[] = [];

  save(report: RuleReviewReport): Promise<void> {
    const stored = this.reports.get(report.id);

    if (stored && isFinishedReview(stored)) {
      return Promise.reject(new ConflictError(`Rule review ${report.id} is ${stored.status}`));
    }

    this.reports.set(report.id, structuredClone(report));
    this.savedStages.push(report.progress.stage);

    return Promise.resolve();
  }

  find(id: string): Promise<RuleReviewReport | null> {
    return Promise.resolve(this.reports.get(id) ?? null);
  }

  list(): Promise<RuleReviewReport[]> {
    return Promise.resolve([...this.reports.values()]);
  }
}
