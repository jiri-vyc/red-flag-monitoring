import { BedrockFindingExplainer } from "./BedrockFindingExplainer";
import { SUBMIT_EXPLANATION_TOOL_NAME } from "./findingExplanationPrompt";
import type { ModelClient, ModelMessage, ModelRequestBody } from "./modelCall";
import {
  createExplanationContext,
  createFinding,
  createRecordingAuditLog,
  createReport,
} from "./testing/ruleReviewTestData";
import {
  createStubModelClient,
  type StubResponse,
  textMessage,
  toolUseMessage,
} from "./testing/stubModelClient";

const MODEL_ID = "test-model";

const VALID_EXPLANATION = {
  summary: "Tři klienti přijímají těsně pod 100 000 CZK.",
  typology: "Strukturování pod prahem (Z4).",
  adjustmentConsiderations: "Pro: malá cena, +3 klienti. Proti: kalibrační hodnota.",
  investigationSteps: ["Ověřit původ příchozích plateb."],
  citedEvidence: [
    { path: "finding.growth.addedClients", value: "3" },
    { path: "finding.proposal.proposedValue", value: "90000" },
  ],
};

function respondWithExplanation(body: ModelRequestBody): ModelMessage {
  if (body.tools === undefined) {
    return textMessage("Přezkum našel jeden nález.");
  }

  return toolUseMessage([{ id: "toolu_1", name: SUBMIT_EXPLANATION_TOOL_NAME, input: VALID_EXPLANATION }]);
}

function createExplainer(respond: (body: ModelRequestBody, callIndex: number) => StubResponse) {
  const stub = createStubModelClient(respond);
  const explainer = new BedrockFindingExplainer({ createClient: async () => stub.client, modelId: MODEL_ID });

  return { explainer, requests: stub.requests };
}

function readEvidence(request: ModelRequestBody | undefined) {
  const prompt = String(request?.messages[0]?.content);

  return { prompt, evidence: JSON.parse(prompt.slice(prompt.indexOf("{"), prompt.lastIndexOf("}") + 1)) };
}

describe("BedrockFindingExplainer.explain", () => {
  it("returns a validated explanation per finding and flags citations that do not match the evidence", async () => {
    const { explainer } = createExplainer(respondWithExplanation);
    const report = createReport();

    const explanations = await explainer.explain(report.findings, createExplanationContext(report));

    expect(explanations["F-01"]?.summary).toBe(VALID_EXPLANATION.summary);
    expect(explanations["F-01"]?.unverifiedCitations).toEqual([
      { path: "finding.proposal.proposedValue", value: "90000", reason: "evidence has 95000" },
    ]);
  });

  it("forces the explanation tool and shows the model at most 10 clients without transaction IDs", async () => {
    const { explainer, requests } = createExplainer(respondWithExplanation);
    const report = createReport([createFinding("F-01", 12)]);

    await explainer.explain(report.findings, createExplanationContext(report));

    const { prompt, evidence } = readEvidence(requests[0]);
    expect(requests[0]?.tool_choice).toEqual({ type: "tool", name: SUBMIT_EXPLANATION_TOOL_NAME });
    expect(evidence.clients).toHaveLength(10);
    expect(evidence.clients[0].clientId).toBe("K0000011");
    expect(prompt).not.toContain("TX1");
  });

  it("uses 1a's client profiles and keeps the finding's seed links next to them", async () => {
    const { explainer, requests } = createExplainer(respondWithExplanation);
    const finding = {
      ...createFinding("F-01", 0),
      clients: [
        {
          clientId: "K001458",
          transactionIds: ["TX9"],
          nearMissCount: 0,
          distinctDays: 0,
          minDistance: null,
          seedLinks: [
            { seedClientId: "K000722", seedReasons: ["aml_risk_score_high"], accounts: ["AKR00143"] },
          ],
        },
      ],
    };
    const report = createReport([finding]);
    const context = {
      ...createExplanationContext(report),
      clientProfilesByFindingId: {
        "F-01": [
          {
            clientId: "K001458",
            clientType: "legal_entity" as const,
            riskScore: "medium" as const,
            isPep: false,
            contractChannel: "in_person" as const,
            tenureMonths: 40,
            nearMissCount: 0,
            minDistance: null,
            findingTransactionCount: 1,
            findingAmountCzk: { total: 1200, max: 1200 },
          },
        ],
      },
    };

    await explainer.explain(report.findings, context);

    expect(readEvidence(requests[0]).evidence.clients[0]).toMatchObject({
      riskScore: "medium",
      tenureMonths: 40,
      seedLinks: [{ seedClientId: "K000722" }],
    });
  });

  it("records every call with prompt, tool call, response, model and tokens in the audit log", async () => {
    const { explainer } = createExplainer(respondWithExplanation);
    const report = createReport();
    const audit = createRecordingAuditLog();

    await explainer.explain(report.findings, createExplanationContext(report, audit));

    expect(audit.calls).toEqual([
      expect.objectContaining({
        purpose: "explanation",
        findingId: "F-01",
        modelId: MODEL_ID,
        inputTokens: 1000,
        outputTokens: 200,
        errorMessage: null,
        toolCalls: [expect.objectContaining({ name: SUBMIT_EXPLANATION_TOOL_NAME })],
        prompt: expect.objectContaining({ system: expect.stringContaining("AML compliance") }),
        response: expect.objectContaining({ stopReason: "tool_use" }),
      }),
    ]);
    expect(audit.errors).toEqual([]);
  });

  it("drops an explanation that does not match the schema and records the error", async () => {
    const { explainer } = createExplainer(() =>
      toolUseMessage([
        { id: "toolu_1", name: SUBMIT_EXPLANATION_TOOL_NAME, input: { summary: "Jen shrnutí." } },
      ]),
    );
    const report = createReport();
    const audit = createRecordingAuditLog();

    const explanations = await explainer.explain(report.findings, createExplanationContext(report, audit));

    expect(explanations).toEqual({});
    expect(audit.errors).toHaveLength(1);
    expect(audit.errors[0]).toMatch(/^Finding F-01: Explanation does not match the schema/);
    expect(audit.calls[0]?.toolCalls[0]?.result).toMatchObject({ error: expect.any(String) });
  });

  it("turns a Bedrock failure into an error entry and keeps the other explanations", async () => {
    const { explainer } = createExplainer((body, callIndex) =>
      callIndex === 0 ? new Error("ThrottlingException") : respondWithExplanation(body),
    );
    const report = createReport([createFinding("F-01"), createFinding("F-02")]);
    const audit = createRecordingAuditLog();

    const explanations = await explainer.explain(report.findings, createExplanationContext(report, audit));

    expect(Object.keys(explanations)).toEqual(["F-02"]);
    expect(audit.errors).toEqual(["Finding F-01: Error: ThrottlingException"]);
    expect(audit.calls[0]).toMatchObject({ findingId: "F-01", errorMessage: "Error: ThrottlingException" });
  });

  it("never throws when the client cannot be created", async () => {
    const explainer = new BedrockFindingExplainer({
      createClient: async () => {
        throw new Error("expired SSO session");
      },
      modelId: MODEL_ID,
    });
    const report = createReport();
    const audit = createRecordingAuditLog();

    await expect(
      explainer.explain(report.findings, createExplanationContext(report, audit)),
    ).resolves.toEqual({});
    expect(audit.errors).toEqual(["Explanations failed: Error: expired SSO session"]);
  });

  it("runs at most the budget's number of explanation calls at a time", async () => {
    let inFlightCount = 0;
    let maxInFlightCount = 0;
    const client: ModelClient = {
      messages: {
        create: async (body) => {
          inFlightCount += 1;
          maxInFlightCount = Math.max(maxInFlightCount, inFlightCount);
          await new Promise((resolve) => setTimeout(resolve, 5));
          inFlightCount -= 1;

          return respondWithExplanation(body);
        },
      },
    };
    const explainer = new BedrockFindingExplainer({ createClient: async () => client, modelId: MODEL_ID });
    const report = createReport(Array.from({ length: 8 }, (_, index) => createFinding(`F-0${index}`)));

    const explanations = await explainer.explain(report.findings, createExplanationContext(report));

    expect(Object.keys(explanations)).toHaveLength(8);
    expect(maxInFlightCount).toBe(report.params.llm.maxConcurrentExplanations);
  });
});

describe("BedrockFindingExplainer.summarize", () => {
  it("summarizes the review from the explanations on the report", async () => {
    const { explainer, requests } = createExplainer(respondWithExplanation);
    const report = createReport();
    const reportWithExplanations = {
      ...report,
      llm: { ...report.llm, explanations: { "F-01": { ...VALID_EXPLANATION, unverifiedCitations: [] } } },
    };
    const audit = createRecordingAuditLog();

    const summary = await explainer.summarize(createExplanationContext(reportWithExplanations, audit));

    expect(summary).toBe("Přezkum našel jeden nález.");
    expect(String(requests[0]?.messages[0]?.content)).toContain(VALID_EXPLANATION.summary);
    expect(audit.calls[0]?.purpose).toBe("summary");
  });

  it("returns null and records the error when the summary is cut off", async () => {
    const { explainer } = createExplainer(() => ({ ...textMessage("Přezkum…"), stop_reason: "max_tokens" }));
    const audit = createRecordingAuditLog();

    const summary = await explainer.summarize(createExplanationContext(createReport(), audit));

    expect(summary).toBeNull();
    expect(audit.errors).toEqual(['Review summary: model stopped with "max_tokens" before finishing']);
  });
});
