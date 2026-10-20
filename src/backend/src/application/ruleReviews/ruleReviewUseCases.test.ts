import { ConflictError, NotFoundError } from "../errors";
import { InMemoryRuleReviewReportStore } from "../testing/InMemoryRuleReviewReportStore";
import { fixedClock, REVIEWED_AT } from "../testing/fixtures";
import { createFakeRuleReviewInputRepository } from "../testing/ruleReviewFixtures";
import type { RuleReviewLauncher } from "./ruleReviewPorts";
import { RuleReviewUseCases } from "./ruleReviewUseCases";

const COMMAND = { createdBy: "00000000-0000-4000-8000-000000000003", evaluationRunId: null, llm: null };
const MINUTE_MS = 60 * 1000;

function createUseCases(input: { launcher?: RuleReviewLauncher; isLlmAvailable?: boolean; now?: Date } = {}) {
  const reportStore = new InMemoryRuleReviewReportStore();
  const launchedIds: string[] = [];
  const useCases = new RuleReviewUseCases({
    reportStore,
    inputRepository: createFakeRuleReviewInputRepository(),
    launcher: input.launcher ?? { launchReview: async (reviewId) => void launchedIds.push(reviewId) },
    clock: () => input.now ?? REVIEWED_AT,
    engineVersion: "test",
    isLlmAvailable: input.isLlmAvailable ?? false,
  });

  return { useCases, reportStore, launchedIds };
}

describe("RuleReviewUseCases", () => {
  it("stores a running review with the input it will cover and launches it", async () => {
    const { useCases, reportStore, launchedIds } = createUseCases();

    const report = await useCases.startReview(COMMAND);

    expect(report).toMatchObject({
      status: "running",
      createdBy: COMMAND.createdBy,
      engineVersion: "test",
      input: { ruleVersionIds: ["rule-version-R-AMT"], evaluationRunId: null },
      params: { llm: { enabled: false } },
    });
    expect(launchedIds).toEqual([report.id]);
    expect(reportStore.reports.get(report.id)?.status).toBe("running");
  });

  it("enables the LLM only when it is configured and not switched off in the request", async () => {
    const configured = createUseCases({ isLlmAvailable: true }).useCases;

    expect((await configured.startReview(COMMAND)).params.llm.enabled).toBe(true);
    expect(
      (await createUseCases({ isLlmAvailable: true }).useCases.startReview({ ...COMMAND, llm: false })).params
        .llm.enabled,
    ).toBe(false);
  });

  it("allows one running review at a time", async () => {
    const { useCases } = createUseCases();
    await useCases.startReview(COMMAND);

    await expect(useCases.startReview(COMMAND)).rejects.toThrow(ConflictError);
  });

  it("shows a review running for more than 20 minutes as failed and lets a new one start", async () => {
    const { useCases, reportStore } = createUseCases();
    const stuck = await useCases.startReview(COMMAND);
    const later = new RuleReviewUseCases({
      reportStore,
      inputRepository: createFakeRuleReviewInputRepository(),
      launcher: { launchReview: () => Promise.resolve() },
      clock: () => new Date(REVIEWED_AT.getTime() + 21 * MINUTE_MS),
      engineVersion: "test",
      isLlmAvailable: false,
    });

    expect((await later.getReview(stuck.id)).status).toBe("failed");
    await expect(later.startReview(COMMAND)).resolves.toMatchObject({ status: "running" });
  });

  it("fails a review the launcher could not start", async () => {
    const { useCases, reportStore } = createUseCases({
      launcher: { launchReview: () => Promise.reject(new Error("no worker")) },
    });

    await expect(useCases.startReview(COMMAND)).rejects.toThrow("no worker");
    expect([...reportStore.reports.values()][0]).toMatchObject({
      status: "failed",
      errorMessage: "The review could not be launched: no worker",
    });
  });

  it("lists summaries newest first with finding counts", async () => {
    const { useCases } = createUseCases();
    const report = await useCases.startReview(COMMAND);

    expect(await useCases.listReviews()).toEqual([
      expect.objectContaining({
        id: report.id,
        status: "running",
        findingCounts: { rule_adjustment: 0, new_rule: 0, coverage_gap: 0, association: 0 },
      }),
    ]);
  });

  it("reports an unknown review as not found", async () => {
    await expect(createUseCases().useCases.getReview("00000000-0000-4000-8000-00000000ffff")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("uses the fixed clock for the start time", async () => {
    const report = await createUseCases().useCases.startReview(COMMAND);

    expect(report.startedAt).toBe(fixedClock().toISOString());
  });
});
