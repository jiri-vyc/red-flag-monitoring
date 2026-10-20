import { randomUUID } from "node:crypto";

import { DEFAULT_HIT_THRESHOLD } from "../../domain/evaluation";
import { DEFAULT_RULE_REVIEW_PARAMS } from "../../domain/ruleReview/ruleReviewParams";
import {
  createRunningReport,
  resolveStuckReview,
  type RuleReviewReport,
  type RuleReviewSummary,
  summarizeReview,
} from "../../domain/ruleReview/ruleReviewReport";
import type { Clock } from "../clock";
import { ConflictError, NotFoundError, toErrorMessage } from "../errors";
import type { RuleReviewInputRepository, RuleReviewLauncher, RuleReviewReportStore } from "./ruleReviewPorts";

export type StartRuleReviewCommand = {
  createdBy: string;
  evaluationRunId: string | null;
  llm: boolean | null;
};

export class RuleReviewUseCases {
  private isStarting = false;

  constructor(
    private readonly dependencies: {
      reportStore: RuleReviewReportStore;
      inputRepository: RuleReviewInputRepository;
      launcher: RuleReviewLauncher;
      clock: Clock;
      engineVersion: string;
      isLlmAvailable: boolean;
    },
  ) {}

  async startReview(command: StartRuleReviewCommand): Promise<RuleReviewReport> {
    if (this.isStarting) {
      throw new ConflictError("A rule review is being started");
    }

    this.isStarting = true;

    try {
      await this.assertNoReviewRunning();

      const { ruleVersionIds, referenceListVersionIds } = await this.dependencies.inputRepository.loadRuleSet(
        {
          evaluationRunId: command.evaluationRunId,
          hitThreshold: DEFAULT_HIT_THRESHOLD,
        },
      );
      const report = createRunningReport({
        id: randomUUID(),
        startedAt: this.dependencies.clock(),
        createdBy: command.createdBy,
        engineVersion: this.dependencies.engineVersion,
        params: {
          ...DEFAULT_RULE_REVIEW_PARAMS,
          llm: {
            ...DEFAULT_RULE_REVIEW_PARAMS.llm,
            enabled: this.dependencies.isLlmAvailable && (command.llm ?? true),
          },
        },
        input: {
          ruleVersionIds,
          referenceListVersionIds,
          transactionSetDigest: "",
          evaluationRunId: command.evaluationRunId,
        },
      });

      await this.dependencies.reportStore.save(report);
      await this.launch(report);

      return report;
    } finally {
      this.isStarting = false;
    }
  }

  async getReview(reviewId: string): Promise<RuleReviewReport> {
    const report = await this.dependencies.reportStore.find(reviewId);

    if (!report) {
      throw new NotFoundError("Rule review", reviewId);
    }

    return resolveStuckReview(report, this.dependencies.clock());
  }

  async listReviews(): Promise<RuleReviewSummary[]> {
    const now = this.dependencies.clock();
    const reports = await this.dependencies.reportStore.list();

    return reports
      .map((report) => summarizeReview(resolveStuckReview(report, now)))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  private async assertNoReviewRunning(): Promise<void> {
    const reviews = await this.listReviews();
    const running = reviews.find((review) => review.status === "running");

    if (running) {
      throw new ConflictError(`Rule review ${running.id} is already running`);
    }
  }

  private async launch(report: RuleReviewReport): Promise<void> {
    try {
      await this.dependencies.launcher.launchReview(report.id);
    } catch (error) {
      await this.dependencies.reportStore.save({
        ...report,
        status: "failed",
        finishedAt: this.dependencies.clock().toISOString(),
        errorMessage: `The review could not be launched: ${toErrorMessage(error)}`,
      });

      throw error;
    }
  }
}
