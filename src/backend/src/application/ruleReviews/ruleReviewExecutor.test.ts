import { AMOUNT_RULE } from "../../domain/ruleReview/testing/ruleReviewTestData";
import type { RuleHypothesis } from "../../domain/ruleReview/ruleReviewReport";
import { InMemoryRuleReviewReportStore } from "../testing/InMemoryRuleReviewReportStore";
import { fixedClock } from "../testing/fixtures";
import { createFakeRuleReviewInputRepository, NEAR_MISS_CLIENT_IDS } from "../testing/ruleReviewFixtures";
import { RuleReviewExecutor } from "./ruleReviewExecutor";
import type { FindingExplainer, FindingExplanationContext, HypothesisExplorer } from "./ruleReviewPorts";
import { RuleReviewUseCases } from "./ruleReviewUseCases";

const NOOP_EXPLAINER: FindingExplainer = { explain: async () => ({}), summarize: async () => null };
const NOOP_EXPLORER: HypothesisExplorer = {
  explore: async () => ({ hypotheses: [], critiques: {}, calls: [], errors: [] }),
};

function hypothesis(id: string, threshold: number, feature = "tx_amount_czk"): RuleHypothesis {
  return {
    id,
    kind: "new_rule",
    missingFeature: null,
    definition: {
      match: "all",
      features: [feature],
      conditions: [{ id: "a", label: "Částka", left: { feature }, op: ">", right: { value: threshold } }],
    },
    descriptionCs: "Hypotéza",
    indicator: "Z9",
    suggestedLegalBasis: null,
    rationale: "Test",
    backtest: null,
  };
}

async function runReview(input: {
  findingExplainer?: FindingExplainer;
  hypothesisExplorer?: HypothesisExplorer;
  isLlmAvailable?: boolean;
}) {
  const reportStore = new InMemoryRuleReviewReportStore();
  const inputRepository = createFakeRuleReviewInputRepository();
  const executor = new RuleReviewExecutor({
    reportStore,
    inputRepository,
    findingExplainer: input.findingExplainer ?? NOOP_EXPLAINER,
    hypothesisExplorer: input.hypothesisExplorer ?? NOOP_EXPLORER,
    clock: fixedClock,
  });
  const useCases = new RuleReviewUseCases({
    reportStore,
    inputRepository,
    launcher: { launchReview: (reviewId) => executor.executeReview(reviewId) },
    clock: fixedClock,
    engineVersion: "test",
    isLlmAvailable: input.isLlmAvailable ?? false,
  });
  const started = await useCases.startReview({ createdBy: "user", evaluationRunId: null, llm: null });

  return { report: await useCases.getReview(started.id), reportStore };
}

describe("RuleReviewExecutor", () => {
  it("runs the deterministic stages and completes the report", async () => {
    const { report, reportStore } = await runReview({});

    expect(report).toMatchObject({
      status: "completed",
      finishedAt: fixedClock().toISOString(),
      errorMessage: null,
    });
    expect(report.input.transactionSetDigest).toHaveLength(64);
    expect(report.findings).toEqual([
      expect.objectContaining({
        id: "R-AMT:condition:a",
        kind: "rule_adjustment",
        rule: expect.objectContaining({ code: "R-AMT", label: "Velká platba" }),
        proposal: expect.objectContaining({ currentValue: 100_000, proposedValue: 95_000 }),
        growth: { baseClients: 1, addedClients: 3, capExceeded: false },
      }),
    ]);
    expect(report.findings[0]?.clients.map((client) => client.clientId)).toEqual(NEAR_MISS_CLIENT_IDS);
    expect(report.coverageMatrix).toHaveLength(12);
    expect(reportStore.savedStages).toEqual(
      expect.arrayContaining(["loading", "baseline", "association", "completed"]),
    );
  });

  it("does not call the LLM ports when the LLM is off", async () => {
    const explain = jest.fn(NOOP_EXPLAINER.explain);

    await runReview({ findingExplainer: { ...NOOP_EXPLAINER, explain } });

    expect(explain).not.toHaveBeenCalled();
  });

  it("keeps the deterministic findings when Bedrock fails and records the error", async () => {
    const { report } = await runReview({
      isLlmAvailable: true,
      findingExplainer: {
        explain: () => Promise.reject(new Error("Bedrock throttled")),
        summarize: async () => null,
      },
    });

    expect(report.status).toBe("completed");
    expect(report.findings).toHaveLength(1);
    expect(report.llm.errors).toEqual(["Bedrock throttled"]);
  });

  it("backtests every hypothesis and turns only the surviving ones into findings", async () => {
    const { report } = await runReview({
      isLlmAvailable: true,
      hypothesisExplorer: {
        explore: async () => ({
          // Above 100 000 only K0 matches; R-AMT already hits K0, so the overlap discards it.
          hypotheses: [
            hypothesis("overlap", 100_000),
            hypothesis("survivor", 96_000),
            hypothesis("missing", 1, "night_share"),
          ],
          critiques: { "R-AMT:condition:a": "Calendar artefact?" },
          calls: [],
          errors: [],
        }),
      },
    });

    expect(
      report.llm.hypotheses.map((checked) => [checked.id, checked.backtest?.discardReason ?? null]),
    ).toEqual([
      ["overlap", "100 % of its clients are already hit by R-AMT"],
      ["survivor", null],
      ["missing", "DSL validation failed: Feature night_share is not in the feature catalogue"],
    ]);
    expect(report.findings.map((finding) => [finding.id, finding.kind])).toEqual([
      ["R-AMT:condition:a", "rule_adjustment"],
      ["new_rule:survivor", "new_rule"],
      ["coverage_gap:missing", "coverage_gap"],
    ]);
    expect(report.llm.critiques).toEqual({ "R-AMT:condition:a": "Calendar artefact?" });
  });

  it("reports a hypothesis that needs a missing feature as a coverage gap without a backtest", async () => {
    const { report } = await runReview({
      isLlmAvailable: true,
      hypothesisExplorer: {
        explore: async () => ({
          hypotheses: [
            {
              ...hypothesis("chain", 1),
              kind: "coverage_gap",
              missingFeature: "payment_chain_depth",
              definition: null,
            },
          ],
          critiques: {},
          calls: [],
          errors: ["Stopped by budget (tool calls), partial results kept"],
        }),
      },
    });

    expect(report.llm.hypotheses[0]).toMatchObject({ kind: "coverage_gap", backtest: null });
    expect(report.findings.at(-1)).toMatchObject({
      id: "coverage_gap:chain",
      kind: "coverage_gap",
      proposal: null,
      evidence: { missingFeature: "payment_chain_depth" },
    });
    expect(report.llm.errors).toEqual(["Stopped by budget (tool calls), partial results kept"]);
  });

  it("caps surviving new rules, not discarded ones, at maxHypotheses", async () => {
    const { report } = await runReview({
      isLlmAvailable: true,
      hypothesisExplorer: {
        explore: async () => ({
          hypotheses: [
            ...Array.from({ length: 5 }, (_, index) => hypothesis(`overlap-${index}`, 100_000)),
            hypothesis("survivor", 96_000),
          ],
          critiques: {},
          calls: [],
          errors: [],
        }),
      },
    });

    expect(report.llm.hypotheses).toHaveLength(6);
    expect(report.findings.map((finding) => finding.id)).toContain("new_rule:survivor");
  });

  it("hands summarize the report with the explanations already on it", async () => {
    const explanation = {
      summary: "Mezera",
      typology: "Strukturování",
      adjustmentConsiderations: "",
      investigationSteps: [],
      citedEvidence: [],
      unverifiedCitations: [],
    };
    const summarize = jest.fn<Promise<string | null>, [FindingExplanationContext]>(async () => "Souhrn");

    const { report } = await runReview({
      isLlmAvailable: true,
      findingExplainer: { explain: async () => ({ "R-AMT:condition:a": explanation }), summarize },
    });

    expect(summarize.mock.calls[0]?.[0]).toMatchObject({
      report: { llm: { explanations: { "R-AMT:condition:a": explanation } } },
    });
    expect(report.llm).toMatchObject({
      summary: "Souhrn",
      summaryUnverifiedNumbers: [],
      explanations: { "R-AMT:condition:a": explanation },
    });
  });

  it("marks numbers in the summary that are not in its input", async () => {
    const { report } = await runReview({
      isLlmAvailable: true,
      findingExplainer: {
        explain: async () => ({}),
        summarize: async (context) =>
          `Přezkum našel ${context.report.findings.length} nálezů, z toho 67 asociačních.`,
      },
    });

    expect(report.llm.summaryUnverifiedNumbers).toEqual(["67"]);
  });

  it("enforces the tool call budget whatever the model asks for", async () => {
    const { report } = await runReview({
      isLlmAvailable: true,
      hypothesisExplorer: {
        explore: async (_report, tools, budget) => {
          for (let call = 0; call <= budget.maxToolCalls; call += 1) {
            await tools.getCoverageMatrix();
          }

          return { hypotheses: [], critiques: {}, calls: [], errors: [] };
        },
      },
    });

    expect(report.llm.errors).toEqual(["Tool call budget of 20 exhausted"]);
  });

  it("fails the review when the input cannot be loaded", async () => {
    const reportStore = new InMemoryRuleReviewReportStore();
    const inputRepository = {
      ...createFakeRuleReviewInputRepository(),
      loadDataset: () => Promise.reject(new Error("db down")),
    };
    const executor = new RuleReviewExecutor({
      reportStore,
      inputRepository,
      findingExplainer: NOOP_EXPLAINER,
      hypothesisExplorer: NOOP_EXPLORER,
      clock: fixedClock,
    });
    const useCases = new RuleReviewUseCases({
      reportStore,
      inputRepository,
      launcher: { launchReview: () => Promise.resolve() },
      clock: fixedClock,
      engineVersion: "test",
      isLlmAvailable: false,
    });
    const started = await useCases.startReview({ createdBy: "user", evaluationRunId: null, llm: null });

    await expect(executor.executeReview(started.id)).rejects.toThrow("db down");
    expect(await useCases.getReview(started.id)).toMatchObject({ status: "failed", errorMessage: "db down" });
    expect(AMOUNT_RULE.ruleCode).toBe("R-AMT");
  });
});
