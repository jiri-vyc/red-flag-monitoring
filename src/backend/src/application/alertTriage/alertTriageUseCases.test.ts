import type { Client } from "../../domain/client";
import type { EvaluationRunReadRepository } from "../evaluationRuns/evaluationRunReadRepository";
import type {
  AlertTriageModel,
  AlertTriageRepository,
  LlmAlertDecision,
  NewAlertTriage,
  NewTriageLlmCall,
  TriageInputData,
} from "./alertTriagePorts";
import { AlertTriageUseCases } from "./alertTriageUseCases";

const RUN_ID = "run-1";
const FIXED_NOW = new Date("2026-10-20T10:00:00Z");

function createClient(clientId: string, overrides: Partial<Client> = {}): Client {
  return {
    clientId,
    country: "CZ",
    contractDate: "2015-03-01",
    contractChannel: "in_person",
    isPep: false,
    clientType: "natural_person",
    projectedMonthlyVolumeCzk: "100000.00",
    projectedMonthlyTxCount: 20,
    q2VolumeCzk: "300000.00",
    q2TxCount: 60,
    q2MaxTxCzk: "20000.00",
    amlRiskScore: "low",
    ...overrides,
  };
}

function createInput(): TriageInputData {
  const createProfileAlert = (clientId: string) => ({
    amlEventId: `event-${clientId}`,
    alertId: `R-01-${clientId}-2026-07`,
    clientId,
    ruleCode: "R-01",
    ruleVersionId: "version-r01",
    ruleText: "Nesoulad s profilem klienta",
    alertType: "profile_mismatch",
    transactionId: null,
    periodMonth: "2026-07",
    maxScore: 58,
    anyConditionCount: 3,
    hits: [{ transactionId: `TX-${clientId}`, metConditionIds: ["b"], traceSummary: "Splněno: b" }],
  });

  return {
    alerts: [createProfileAlert("K000001"), createProfileAlert("K000002")],
    clients: [createClient("K000001"), createClient("K000002", { isPep: true })],
    transactions: ["K000001", "K000002"].map((clientId) => ({
      transactionId: `TX-${clientId}`,
      clientId,
      occurredAt: new Date(2026, 6, 10),
      amount: "50000.00",
      currency: "CZK",
      payerCountry: "CZ",
      payeeCountry: "CZ",
      payerAccount: "CZ01",
      payeeAccount: "CZ02",
      transactionType: "incoming" as const,
      counterpartyAccount: "CZ01",
      counterpartyCountry: "CZ",
    })),
    fxRates: [],
    highRiskCountries: [],
  };
}

class InMemoryAlertTriageRepository implements AlertTriageRepository {
  ruleTriages: NewAlertTriage[] = [];
  llmSaves: { call: NewTriageLlmCall; triages: NewAlertTriage[] }[] = [];
  clientIdsWithLlmTriage: string[] = [];

  loadTriageInput(input: { runId: string; clientIds: string[] | null }): Promise<TriageInputData> {
    const data = createInput();
    const isSelected = (clientId: string) => input.clientIds === null || input.clientIds.includes(clientId);

    return Promise.resolve({ ...data, alerts: data.alerts.filter(({ clientId }) => isSelected(clientId)) });
  }

  listClientIdsWithLlmTriage(): Promise<string[]> {
    return Promise.resolve(this.clientIdsWithLlmTriage);
  }

  saveRuleTriages(triages: NewAlertTriage[]): Promise<void> {
    this.ruleTriages.push(...triages);
    return Promise.resolve();
  }

  saveLlmTriages(input: { call: NewTriageLlmCall; triages: NewAlertTriage[] }): Promise<void> {
    this.llmSaves.push(input);
    return Promise.resolve();
  }
}

function createModel(decide: (alertId: string) => LlmAlertDecision | null): AlertTriageModel & {
  calls: string[];
} {
  const calls: string[] = [];

  return {
    modelId: "test-model",
    calls,
    triageClient: ({ triageCase }) => {
      calls.push(triageCase.client.clientId);

      return Promise.resolve({
        clientAssessment: "Story",
        decisions: triageCase.alerts.flatMap(({ alertId }) => decide(alertId) ?? []),
        call: {
          modelId: "test-model",
          systemPrompt: "system",
          userPrompt: "user",
          response: {},
          inputTokens: 100,
          outputTokens: 20,
          durationMs: 5,
        },
      });
    },
  };
}

function createSubject(model: AlertTriageModel) {
  const repository = new InMemoryAlertTriageRepository();
  const useCases = new AlertTriageUseCases({
    alertTriageRepository: repository,
    evaluationRunReadRepository: {} as EvaluationRunReadRepository,
    alertTriageModel: model,
    alertTriageLauncher: { launchLlmTriage: () => Promise.resolve() },
    clock: () => FIXED_NOW,
    llmConcurrency: 2,
  });

  return { repository, useCases };
}

const fpDecision = (alertId: string): LlmAlertDecision => ({
  alertId,
  triage: "FP",
  reason: "In line with Q2.",
});

describe("AlertTriageUseCases", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("stores a rule-based proposal with priority and decision log for every alert", async () => {
    const { repository, useCases } = createSubject(createModel(fpDecision));

    await expect(useCases.triageRunWithRules(RUN_ID)).resolves.toBe(2);

    expect(repository.ruleTriages).toMatchObject([
      { amlEventId: "event-K000001", source: "rules", triage: "FP", priority: 15 },
      { amlEventId: "event-K000002", source: "rules", triage: "REVIEW", priority: 30 },
    ]);
    expect(repository.ruleTriages[0]?.log).toMatchObject({
      decided_at: FIXED_NOW.toISOString(),
      rule_code: "R-01",
      rule_version_id: "version-r01",
      decision_aid_only: true,
    });
  });

  it("stores the model's triage with its call and overrides an FP behind a guardrail", async () => {
    const { repository, useCases } = createSubject(createModel(fpDecision));

    await useCases.triageRunWithLlm({ runId: RUN_ID, clientIds: null, clientLimit: null });

    const savesByClient = new Map(repository.llmSaves.map((save) => [save.call.clientId, save]));
    expect(savesByClient.get("K000001")?.triages).toMatchObject([
      { source: "llm", triage: "FP", reason: "In line with Q2.", log: { overridden_by_guardrail: false } },
    ]);
    expect(savesByClient.get("K000002")?.triages[0]).toMatchObject({
      triage: "REVIEW",
      log: { model_triage: "FP", overridden_by_guardrail: true },
    });
    expect(savesByClient.get("K000002")?.call).toMatchObject({ runId: RUN_ID, modelId: "test-model" });
  });

  it("triages the highest priority clients first and skips clients the model already triaged", async () => {
    const model = createModel(fpDecision);
    const { repository, useCases } = createSubject(model);
    repository.clientIdsWithLlmTriage = ["K000002"];

    const summary = await useCases.triageRunWithLlm({ runId: RUN_ID, clientIds: null, clientLimit: 1 });

    expect(model.calls).toEqual(["K000001"]);
    expect(summary).toEqual({ triagedClients: 1, failedClients: 0, skippedClients: 1 });
  });

  it("stores nothing for a client whose alerts the model left undecided", async () => {
    const { repository, useCases } = createSubject(createModel(() => null));

    const summary = await useCases.triageRunWithLlm({
      runId: RUN_ID,
      clientIds: ["K000001"],
      clientLimit: null,
    });

    expect(summary).toMatchObject({ triagedClients: 0, failedClients: 1 });
    expect(repository.llmSaves).toEqual([]);
  });
});
