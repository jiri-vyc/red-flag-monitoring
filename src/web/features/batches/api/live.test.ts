import { CURRENT_USER } from "@/config/currentUser";
import { ApiError } from "@/lib/apiError";
import { requestJson } from "@/lib/httpClient";

import { liveBatchesService } from "./live";

// Requests are served by a mocked HTTP client, never by the shared backend database.
jest.mock("@/lib/httpClient", () => ({ requestJson: jest.fn() }));
const requestJsonMock = jest.mocked(requestJson);

const RUN = {
  id: "run-1",
  status: "running",
  scope: { from: null, to: null, clientIds: null, limit: null },
  fileName: "database: all transactions",
  rowsTotal: 10,
  rowsImported: 10,
  txProcessed: 3,
  txPassed: 2,
  txFlagged: 1,
  txError: 0,
  hitThreshold: 50,
  createdBy: "user-1",
  createdAt: "2026-10-19T10:00:00.000Z",
  finishedAt: null,
  errorMessage: null,
};

beforeEach(() => requestJsonMock.mockReset());

describe("liveBatchesService", () => {
  it("hides the CSV upload (BE-01) and keeps throwing unsupported without calling the API", async () => {
    expect(liveBatchesService.capabilities.canUploadBatch).toBe(false);
    await expect(
      liveBatchesService.uploadBatch({ file: new File(["a;b"], "batch.csv"), uploadedBy: "analyst" }),
    ).rejects.toMatchObject({ kind: "unsupported" });
    expect(requestJson).not.toHaveBeenCalled();
  });

  it("offers starting a run and posts only the creator for a full run", async () => {
    requestJsonMock.mockImplementation(async ({ path, method = "GET" }) => {
      if (method === "POST" && path === "/evaluation-runs") {
        return { id: "run-1" };
      }
      if (method === "GET" && path === "/evaluation-runs/run-1") {
        return { run: RUN, ruleVersions: [{ ruleVersionId: "version-1" }] };
      }
      throw new Error(`Unexpected request ${method} ${path}`);
    });

    expect(liveBatchesService.capabilities.canStartRun).toBe(true);
    const batch = await liveBatchesService.startRun({ startedBy: "analyst", scope: {} });

    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/evaluation-runs",
        method: "POST",
        jsonBody: { createdBy: CURRENT_USER.id },
      }),
    );
    expect(batch).toMatchObject({
      id: "run-1",
      status: "processing",
      processedRowCount: 3,
      evaluatedRowCount: 10,
      activeRuleCount: 1,
      finishedAt: null,
      isFullDatasetRun: true,
    });
  });

  it("sends only the scope fields that are set", async () => {
    requestJsonMock.mockImplementation(async ({ method = "GET" }) =>
      method === "POST" ? { id: "run-1" } : { run: RUN, ruleVersions: [] },
    );

    await liveBatchesService.startRun({
      startedBy: "analyst",
      scope: { limit: 1000, from: "2026-07-01", to: undefined },
    });

    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        jsonBody: { createdBy: CURRENT_USER.id, scope: { limit: 1000, from: "2026-07-01" } },
      }),
    );
  });

  it("passes a rejected run start on as a validation error", async () => {
    requestJsonMock.mockRejectedValue(
      new ApiError({ kind: "validation", status: 422, message: "The run scope matches no transactions" }),
    );

    await expect(
      liveBatchesService.startRun({ startedBy: "analyst", scope: { from: "2030-01-01" } }),
    ).rejects.toMatchObject({ kind: "validation" });
  });

  it.each([
    ["importing", "processing"],
    ["running", "processing"],
    ["completed", "completed"],
    ["failed", "failed"],
  ] as const)("maps a polled %s run to a %s batch", async (runStatus, batchStatus) => {
    requestJsonMock.mockResolvedValue({
      run: {
        ...RUN,
        status: runStatus,
        errorMessage: runStatus === "failed" ? "Rule engine crashed" : null,
      },
      ruleVersions: [],
    });

    const batch = await liveBatchesService.loadBatch("run-1");

    expect(batch.status).toBe(batchStatus);
    expect(batch.failureReason).toBe(runStatus === "failed" ? "Rule engine crashed" : null);
    expect(requestJsonMock).toHaveBeenCalledWith(expect.objectContaining({ path: "/evaluation-runs/run-1" }));
  });

  it("keeps the finish time and marks only an empty database scope as a full-dataset run", async () => {
    const finishedAt = "2026-10-19T10:04:13.000Z";
    requestJsonMock.mockResolvedValueOnce({
      run: { ...RUN, status: "completed", finishedAt, scope: { ...RUN.scope, limit: 1000 } },
      ruleVersions: [],
    });
    requestJsonMock.mockResolvedValueOnce({ run: { ...RUN, scope: null }, ruleVersions: [] });

    const limitedBatch = await liveBatchesService.loadBatch("run-1");
    const uploadedBatch = await liveBatchesService.loadBatch("run-1");

    expect(limitedBatch).toMatchObject({ finishedAt, isFullDatasetRun: false });
    expect(uploadedBatch.isFullDatasetRun).toBe(false);
  });

  it("flattens nested condition groups and keeps the base score only for scored evaluations", async () => {
    const operand = (feature: string, value: number) => ({ feature, value });
    requestJsonMock.mockResolvedValue({
      evaluation: {
        runId: "run-1",
        transactionId: "TX000000001",
        verdict: "flagged",
        maxScore: 80,
        hitCount: 1,
      },
      transaction: {
        transactionId: "TX000000001",
        clientId: "K000001",
        occurredAt: "2026-07-01T10:00:00.000Z",
        amount: "1000.00",
        currency: "CZK",
        payerCountry: "CZ",
        payeeCountry: "SK",
        payerAccount: null,
        payeeAccount: "K000001",
        transactionType: "incoming payment",
      },
      client: { clientId: "K000001", country: "CZ", isPep: false, amlRiskScore: "high" },
      ruleEvaluations: [
        {
          outcome: "hit",
          skipReason: null,
          rawScore: 80,
          adjustedScore: 80,
          features: null,
          errorMessage: null,
          rule: { id: "rule-1", code: "R1", alertType: "Velká částka", kind: "deterministic" },
          ruleVersion: { versionNo: 1, humanText: "Velká částka", baseScore: 80, sensitivity: 100 },
          trace: {
            summary: "Hit",
            conditions: [
              {
                label: "Rizikový klient",
                match: "all",
                result: true,
                conditions: [
                  {
                    label: "Částka",
                    left: operand("amount_czk", 1000),
                    op: ">",
                    right: { value: 500 },
                    result: true,
                  },
                ],
              },
            ],
          },
        },
        {
          outcome: "error",
          skipReason: null,
          rawScore: null,
          adjustedScore: null,
          features: null,
          errorMessage: "Timeout",
          rule: { id: "rule-2", code: "R2", alertType: "Agent", kind: "deterministic" },
          ruleVersion: { versionNo: 2, humanText: "Agent", baseScore: 60, sensitivity: 50 },
          trace: null,
        },
      ],
    });

    const evaluation = await liveBatchesService.loadTransactionEvaluation({
      batchId: "run-1",
      transactionId: "TX000000001",
    });

    expect(evaluation.failedRules[0]?.trace).toEqual([
      { condition: "Rizikový klient", isMet: true, detail: "all (1)" },
      { condition: "Rizikový klient › Částka", isMet: true, detail: "amount_czk (1000) > 500" },
    ]);
    expect(
      evaluation.failedRules.map(({ ruleId, baseScore, score }) => ({ ruleId, baseScore, score })),
    ).toEqual([
      { ruleId: "rule-1", baseScore: 80, score: 80 },
      // An errored evaluation has no score, so its base score is not shown.
      { ruleId: "rule-2", baseScore: null, score: 0 },
    ]);
  });
});
