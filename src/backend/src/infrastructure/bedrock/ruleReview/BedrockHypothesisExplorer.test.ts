import { describeFeatureCatalog } from "../../../domain/features/featureCatalog";
import type { FlatRuleDefinition } from "../flatRuleDefinition";
import { BedrockHypothesisExplorer } from "./BedrockHypothesisExplorer";
import type { RuleReviewTools } from "../../../application/ruleReviews/ruleReviewPorts";
import type { LlmBudget } from "../../../domain/ruleReview/ruleReviewParams";
import type { RuleBacktest } from "../../../domain/ruleReview/ruleReviewReport";
import { HYPOTHESIS_TOOL_NAMES } from "./hypothesisPrompt";
import type { ModelMessage, ModelRequestBody, ToolResultBlock } from "./modelCall";
import { createBacktest, createReport } from "./testing/ruleReviewTestData";
import {
  createStubModelClient,
  type StubResponse,
  textMessage,
  toolUseMessage,
} from "./testing/stubModelClient";

const REPORT = createReport();
const BUDGET = REPORT.params.llm;

// The backtest stub answers by the threshold of the definition's first condition.
const BACKTESTS: Record<string, Partial<RuleBacktest>> = {
  "50000": { sampleClientIds: Array.from({ length: 15 }, (_, index) => `K00${index}`) },
  "55000": {},
  "1000": { clientCount: 300, discardReason: "hits 5.5 % of clients, more than 1 %" },
  "60000": { maxOverlap: { ruleCode: "R-11", share: 0.8 }, discardReason: "overlaps 80 % with R-11" },
  "70000": { clientCount: 0, hitCount: 0 },
};

function createDefinition(threshold: string, featureId = "tx_amount_czk"): FlatRuleDefinition {
  return {
    match: "all",
    features: [featureId],
    groups: [],
    conditions: [
      {
        id: "a",
        label: "Částka",
        parentGroupId: "root",
        left: { kind: "feature", value: featureId },
        op: ">=",
        right: { kind: "number", value: threshold },
      },
    ],
  };
}

function propose(id: string, threshold: string, featureId?: string) {
  return {
    id,
    name: HYPOTHESIS_TOOL_NAMES.proposeHypothesis,
    input: {
      descriptionCs: `Alert, pokud částka ≥ ${threshold} CZK.`,
      rationale: "Z11 nemá pravidlo.",
      indicator: "Z11",
      suggestedLegalBasis: "AMLZ § 6 odst. 1 písm. g)",
      definition: createDefinition(threshold, featureId),
    },
  };
}

function callTool(id: string, name: string, input: unknown = {}) {
  return { id, name, input };
}

function createTools(): { tools: RuleReviewTools; backtestedThresholds: string[] } {
  const backtestedThresholds: string[] = [];
  const tools: RuleReviewTools = {
    getRuleCatalogue: async () => [],
    getFeatureCatalogue: async () => describeFeatureCatalog(),
    getCoverageMatrix: async () => REPORT.coverageMatrix,
    getGapFindings: async () => [],
    getSegmentProfiles: async () => [],
    getCounterpartyStructure: async () => ({
      accountCount: 5380,
      clientsPerAccount: { median: 9, p90: 75, p99: 1311, max: 1372 },
      seedCount: 477,
      linkTable: [],
      strongFlowClients: { privateAccounts: 1, anyAccount: 1969 },
    }),
    backtestRule: async (definition) => {
      const condition = definition.conditions[0];
      const threshold =
        condition && "right" in condition && "value" in condition.right ? String(condition.right.value) : "";
      backtestedThresholds.push(threshold);

      return createBacktest(BACKTESTS[threshold]);
    },
  };

  return { tools, backtestedThresholds };
}

function createExplorer(
  respond: (body: ModelRequestBody, callIndex: number) => StubResponse,
  now = Date.now,
) {
  const stub = createStubModelClient(respond);
  const explorer = new BedrockHypothesisExplorer({
    createClient: async () => stub.client,
    modelId: "test-model",
    now,
  });

  return { explorer, requests: stub.requests };
}

function respondInTurns(turns: StubResponse[]) {
  return (_body: ModelRequestBody, callIndex: number): StubResponse =>
    turns[callIndex] ?? textMessage("Hotovo.");
}

function alwaysCallTool(name: string, usage: Partial<ModelMessage["usage"]> = {}) {
  return (_body: ModelRequestBody, callIndex: number) =>
    toolUseMessage([callTool(`toolu_${callIndex}`, name)], usage);
}

function readToolResults(
  request: ModelRequestBody | undefined,
): Record<string, { content: unknown; isError: boolean }> {
  const lastMessage = request?.messages.at(-1);
  const blocks = Array.isArray(lastMessage?.content) ? (lastMessage.content as ToolResultBlock[]) : [];

  return Object.fromEntries(
    blocks.map((block) => [
      block.tool_use_id,
      { content: JSON.parse(block.content), isError: block.is_error },
    ]),
  );
}

function withBudget(overrides: Partial<LlmBudget>): LlmBudget {
  return { ...BUDGET, ...overrides };
}

describe("BedrockHypothesisExplorer", () => {
  it("keeps every backtested hypothesis, marking the ones the caps or DSL validation discard", async () => {
    const { explorer, requests } = createExplorer(
      respondInTurns([
        toolUseMessage([
          callTool("info_1", HYPOTHESIS_TOOL_NAMES.getRuleCatalogue),
          callTool("info_2", HYPOTHESIS_TOOL_NAMES.getCoverageMatrix),
        ]),
        toolUseMessage([
          propose("good", "50000"),
          propose("too_many_clients", "1000"),
          propose("overlapping", "60000"),
          propose("no_clients", "70000"),
          propose("invalid", "50000", "not_a_feature"),
        ]),
        textMessage("Hotovo."),
      ]),
    );
    const { tools, backtestedThresholds } = createTools();

    const result = await explorer.explore(REPORT, tools, BUDGET);

    expect(backtestedThresholds).toEqual(["50000", "1000", "60000", "70000"]);
    expect(result.hypotheses.map(({ id, backtest }) => [id, backtest?.discardReason])).toEqual([
      ["H-1", null],
      ["H-2", "hits 5.5 % of clients, more than 1 %"],
      ["H-3", "overlaps 80 % with R-11"],
      ["H-4", "the rule hits no client"],
    ]);
    expect(result.hypotheses[0]).toMatchObject({ kind: "new_rule", indicator: "Z11", missingFeature: null });
    expect(result.errors).toEqual([]);

    const results = readToolResults(requests[2]);
    expect(results.good?.content).toMatchObject({ status: "accepted", hypothesisId: "H-1" });
    expect(results.too_many_clients?.content).toMatchObject({ status: "rejected", hypothesisId: "H-2" });
    expect(String((results.invalid?.content as { reason: string }).reason)).toContain("not_a_feature");
  });

  it("shows the model at most maxSampleClientIds sample client IDs per backtest", async () => {
    const { explorer, requests } = createExplorer(
      respondInTurns([toolUseMessage([propose("good", "50000")])]),
    );

    const result = await explorer.explore(REPORT, createTools().tools, BUDGET);

    expect(result.hypotheses[0]?.backtest?.sampleClientIds).toHaveLength(BUDGET.maxSampleClientIds);
    const content = readToolResults(requests[1]).good?.content as { backtest: RuleBacktest };
    expect(content.backtest.sampleClientIds).toHaveLength(BUDGET.maxSampleClientIds);
  });

  it("records coverage gaps and critiques without changing findings, and rejects unknown findings", async () => {
    const { explorer, requests } = createExplorer(
      respondInTurns([
        toolUseMessage([
          callTool("gap", HYPOTHESIS_TOOL_NAMES.reportCoverageGap, {
            descriptionCs: "Chybí vazba plátce na klienta.",
            rationale: "Z11 nemá pravidlo.",
            indicator: "Z11",
            missingFeature: "payer_is_third_party",
          }),
          callTool("critique", HYPOTHESIS_TOOL_NAMES.addCritique, {
            findingId: "F-01",
            comment: "Kalendářní artefakt?",
          }),
          callTool("unknown", HYPOTHESIS_TOOL_NAMES.addCritique, { findingId: "F-99", comment: "?" }),
        ]),
      ]),
    );

    const result = await explorer.explore(REPORT, createTools().tools, BUDGET);

    expect(result.hypotheses).toEqual([
      expect.objectContaining({
        kind: "coverage_gap",
        definition: null,
        backtest: null,
        missingFeature: "payer_is_third_party",
      }),
    ]);
    expect(result.critiques).toEqual({ "F-01": "Kalendářní artefakt?" });
    expect(readToolResults(requests[1]).unknown?.isError).toBe(true);
    expect(REPORT.findings[0]?.evidence).toEqual(createReport().findings[0]?.evidence);
  });

  it("refuses proposals beyond the accepted hypothesis limit", async () => {
    const { explorer, requests } = createExplorer(
      respondInTurns([toolUseMessage([propose("first", "50000"), propose("second", "55000")])]),
    );

    const result = await explorer.explore(REPORT, createTools().tools, withBudget({ maxHypotheses: 1 }));

    expect(result.hypotheses).toHaveLength(1);
    expect(readToolResults(requests[1]).second?.isError).toBe(true);
  });

  it("stops at the tool call budget and keeps the results gathered so far", async () => {
    const { explorer } = createExplorer(
      respondInTurns([
        toolUseMessage([propose("good", "50000")]),
        toolUseMessage([
          callTool("catalogue_1", HYPOTHESIS_TOOL_NAMES.getRuleCatalogue),
          callTool("catalogue_2", HYPOTHESIS_TOOL_NAMES.getRuleCatalogue),
          callTool("catalogue_3", HYPOTHESIS_TOOL_NAMES.getRuleCatalogue),
        ]),
      ]),
    );

    const result = await explorer.explore(REPORT, createTools().tools, withBudget({ maxToolCalls: 3 }));

    expect(result.hypotheses).toHaveLength(1);
    expect(result.calls).toHaveLength(2);
    expect(result.calls[1]?.toolCalls).toHaveLength(2);
    expect(result.errors).toEqual([
      "Hypothesis loop stopped early, partial results kept: tool call limit of 3 reached",
    ]);
  });

  it("stops before the next call could exceed the input token budget, counting cached tokens", async () => {
    const { explorer, requests } = createExplorer(
      alwaysCallTool(HYPOTHESIS_TOOL_NAMES.getCoverageMatrix, {
        input_tokens: 600,
        cache_read_input_tokens: 400,
      }),
    );

    const result = await explorer.explore(REPORT, createTools().tools, withBudget({ maxInputTokens: 2_500 }));

    expect(requests).toHaveLength(2);
    expect(result.errors[0]).toContain("input token limit of 2500");
  });

  it("caps each turn's output tokens by what is left of the output budget", async () => {
    const { explorer, requests } = createExplorer(
      alwaysCallTool(HYPOTHESIS_TOOL_NAMES.getCoverageMatrix, { output_tokens: 200 }),
    );

    const result = await explorer.explore(REPORT, createTools().tools, withBudget({ maxOutputTokens: 500 }));

    expect(requests.map(({ max_tokens }) => max_tokens)).toEqual([500, 300, 100]);
    expect(result.errors[0]).toContain("output token limit of 500");
  });

  it("stops at the wall clock limit", async () => {
    let currentMs = 0;
    const { explorer, requests } = createExplorer(
      (_body, callIndex) => {
        currentMs += 200_000;
        return toolUseMessage([callTool(`toolu_${callIndex}`, HYPOTHESIS_TOOL_NAMES.getCoverageMatrix)]);
      },
      () => currentMs,
    );

    const result = await explorer.explore(
      REPORT,
      createTools().tools,
      withBudget({ maxWallClockMs: 300_000 }),
    );

    expect(requests).toHaveLength(2);
    expect(result.errors[0]).toContain("wall clock limit of 300 s");
  });

  it("keeps accepted hypotheses when Bedrock fails mid-loop", async () => {
    const { explorer } = createExplorer(
      respondInTurns([toolUseMessage([propose("good", "50000")]), new Error("ServiceUnavailableException")]),
    );

    const result = await explorer.explore(REPORT, createTools().tools, BUDGET);

    expect(result.hypotheses).toHaveLength(1);
    expect(result.errors).toEqual(["Hypothesis loop: Error: ServiceUnavailableException"]);
    expect(result.calls[1]).toMatchObject({
      errorMessage: "Error: ServiceUnavailableException",
      response: null,
    });
  });

  it("audits each turn with only the messages it adds to the conversation", async () => {
    const { explorer } = createExplorer(
      respondInTurns([toolUseMessage([callTool("info", HYPOTHESIS_TOOL_NAMES.getCoverageMatrix)])]),
    );

    const result = await explorer.explore(REPORT, createTools().tools, BUDGET);

    const [firstCall, secondCall] = result.calls;
    expect(firstCall).toMatchObject({ purpose: "hypotheses", inputTokens: 1000, outputTokens: 200 });
    expect(firstCall?.prompt).toMatchObject({ system: expect.stringContaining("DSL") });
    expect(firstCall?.toolCalls).toEqual([
      { name: HYPOTHESIS_TOOL_NAMES.getCoverageMatrix, input: {}, result: REPORT.coverageMatrix },
    ]);
    expect(secondCall?.prompt).toMatchObject({
      system: null,
      messages: [expect.objectContaining({ role: "user" })],
    });
  });

  it("never throws when the client cannot be created", async () => {
    const explorer = new BedrockHypothesisExplorer({
      createClient: async () => {
        throw new Error("no credentials");
      },
      modelId: "test-model",
      now: Date.now,
    });

    const result = await explorer.explore(REPORT, createTools().tools, BUDGET);

    expect(result).toEqual({
      hypotheses: [],
      critiques: {},
      calls: [],
      errors: ["Hypothesis loop failed: Error: no credentials"],
    });
  });
});
