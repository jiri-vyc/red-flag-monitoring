import { ApiError } from "@/lib/apiError";
import { requestJson } from "@/lib/httpClient";

import { liveBatchesService } from "./live";

// Requests are served by a mocked HTTP client, never by the shared backend database.
jest.mock("@/lib/httpClient", () => ({ requestJson: jest.fn() }));
const requestJsonMock = jest.mocked(requestJson);

const RUN = {
  id: "run-1",
  status: "running",
  fileName: "transactions.csv",
  rowsTotal: 10,
  rowsImported: 10,
  txProcessed: 3,
  txPassed: 2,
  txFlagged: 1,
  txError: 0,
  createdBy: "user-1",
  createdAt: "2026-10-19T10:00:00.000Z",
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

  it("hides starting a run (BE-01) and passes the backend's 501 on as unsupported", async () => {
    requestJsonMock.mockRejectedValue(new ApiError({ kind: "unsupported", status: 501, message: "501" }));

    expect(liveBatchesService.capabilities.canStartRun).toBe(false);
    await expect(liveBatchesService.startRun({ startedBy: "analyst" })).rejects.toMatchObject({
      kind: "unsupported",
    });
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/evaluation-runs", method: "POST" }),
    );
  });

  it("opens a started run by its summary once the backend implements it", async () => {
    requestJsonMock.mockImplementation(async ({ path, method = "GET" }) => {
      if (method === "POST" && path === "/evaluation-runs") {
        return { id: "run-1" };
      }
      if (method === "GET" && path === "/evaluation-runs/run-1") {
        return { run: RUN, ruleVersions: [{ ruleVersionId: "version-1" }] };
      }
      throw new Error(`Unexpected request ${method} ${path}`);
    });

    const batch = await liveBatchesService.startRun({ startedBy: "analyst" });

    expect(batch).toMatchObject({ id: "run-1", status: "processing", activeRuleCount: 1 });
  });

  it("flattens nested condition groups of a deterministic trace", async () => {
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
          ruleVersion: { versionNo: 1, sensitivity: 100 },
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
  });
});
