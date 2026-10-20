import { DEFAULT_RULE_REVIEW_PARAMS } from "./ruleReviewParams";
import {
  EMPTY_LLM_SECTION,
  resolveStuckReview,
  type RuleReviewReport,
  STUCK_REVIEW_MESSAGE,
} from "./ruleReviewReport";

const RUNNING: RuleReviewReport = {
  id: "review-1",
  status: "running",
  startedAt: "2026-10-20T10:00:00.000Z",
  finishedAt: null,
  errorMessage: null,
  createdBy: "user-1",
  engineVersion: "local",
  params: DEFAULT_RULE_REVIEW_PARAMS,
  input: { ruleVersionIds: [], referenceListVersionIds: [], transactionSetDigest: "", evaluationRunId: null },
  progress: { stage: "baseline", done: 0, total: 1 },
  coverageMatrix: [],
  findings: [],
  llm: EMPTY_LLM_SECTION,
};

describe("resolveStuckReview", () => {
  it("shows a review running for more than 20 minutes as failed", () => {
    expect(resolveStuckReview(RUNNING, new Date("2026-10-20T10:20:01.000Z"))).toMatchObject({
      status: "failed",
      errorMessage: STUCK_REVIEW_MESSAGE,
    });
  });

  it("leaves a review within 20 minutes and a finished review as they are", () => {
    const completed = { ...RUNNING, status: "completed" as const };

    expect(resolveStuckReview(RUNNING, new Date("2026-10-20T10:19:59.000Z"))).toBe(RUNNING);
    expect(resolveStuckReview(completed, new Date("2026-10-21T10:00:00.000Z"))).toBe(completed);
  });
});
