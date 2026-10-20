import type { RuleReviewsService } from "@/features/ruleReviews/api/contract";
import { ruleReviewReportDtoSchema } from "@/features/ruleReviews/api/dto";
import type { RuleReviewReport, RuleReviewSummary } from "@/features/ruleReviews/types";
import { ApiError } from "@/lib/apiError";

import { simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import fixtureReport from "../seed/ruleReviewReport.json";

const FIXTURE_REPORT: RuleReviewReport = ruleReviewReportDtoSchema.parse(fixtureReport);
const SIMULATED_STAGES = ["loading", "baseline", "feature_sweeps", "association"];
const SIMULATED_RUN_MS = 6000;

type MockReview = { report: RuleReviewReport; startedAtMs: number };

const startedReviews: MockReview[] = [];

function resolveReport({ report, startedAtMs }: MockReview, nowMs: number): RuleReviewReport {
  const elapsedShare = (nowMs - startedAtMs) / SIMULATED_RUN_MS;

  if (elapsedShare >= 1) {
    return {
      ...FIXTURE_REPORT,
      id: report.id,
      startedAt: report.startedAt,
      createdBy: report.createdBy,
      status: "completed",
      finishedAt: new Date(startedAtMs + SIMULATED_RUN_MS).toISOString(),
      progress: { stage: "completed", done: 1, total: 1 },
    };
  }

  const stageIndex = Math.min(
    SIMULATED_STAGES.length - 1,
    Math.floor(elapsedShare * SIMULATED_STAGES.length),
  );
  return {
    ...report,
    progress: {
      stage: SIMULATED_STAGES[stageIndex] ?? "loading",
      done: Math.round(elapsedShare * 100),
      total: 100,
    },
  };
}

function listReports(): RuleReviewReport[] {
  const nowMs = Date.now();
  return [...startedReviews.map((review) => resolveReport(review, nowMs)), FIXTURE_REPORT];
}

function toSummary(report: RuleReviewReport): RuleReviewSummary {
  const countKind = (kind: RuleReviewReport["findings"][number]["kind"]) =>
    report.findings.filter((finding) => finding.kind === kind).length;
  return {
    id: report.id,
    status: report.status,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    errorMessage: report.errorMessage,
    createdBy: report.createdBy,
    progress: report.progress,
    evaluationRunId: report.input.evaluationRunId,
    findingCounts: {
      rule_adjustment: countKind("rule_adjustment"),
      new_rule: countKind("new_rule"),
      coverage_gap: countKind("coverage_gap"),
      association: countKind("association"),
    },
  };
}

export const mockRuleReviewsService: RuleReviewsService = {
  capabilities: { canStartReview: true },

  async loadReviews() {
    await simulateLatency();
    return listReports()
      .map(toSummary)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  },

  async loadReview(reviewId) {
    await simulateLatency();
    return (
      listReports().find((report) => report.id === reviewId) ?? throwMockNotFound("Rule review", reviewId)
    );
  },

  async startReview({ startedBy }) {
    await simulateLatency();
    if (listReports().some((report) => report.status === "running")) {
      throw new ApiError({ kind: "validation", status: 409, message: "A rule review is already running" });
    }
    const startedAtMs = Date.now();
    const report: RuleReviewReport = {
      ...FIXTURE_REPORT,
      id: crypto.randomUUID(),
      status: "running",
      startedAt: new Date(startedAtMs).toISOString(),
      finishedAt: null,
      createdBy: startedBy,
      progress: { stage: "loading", done: 0, total: 100 },
      coverageMatrix: [],
      findings: [],
    };
    startedReviews.unshift({ report, startedAtMs });
    return report;
  },
};
