import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { forgetSelectedApiModeForTests } from "@/config/apiMode";
import { requestJson } from "@/lib/httpClient";
import { ApiModeProvider } from "@/providers/ApiModeProvider";
import { MockUsageProvider } from "@/providers/MockUsageProvider";

import type { Batch } from "../types";
import type { EvaluationRunListItemDto } from "./dto";
import { findProcessingPollInterval, useBatch, useBatches, useStartEvaluationRun } from "./hooks";

// Live mode against a mocked HTTP client: no request ever reaches the shared backend database.
jest.mock("@/config/env.client", () => ({ clientEnv: { NEXT_PUBLIC_API_MODE: "live" } }));
jest.mock("@/lib/httpClient", () => ({ requestJson: jest.fn() }));
const requestJsonMock = jest.mocked(requestJson);

const LIVE_POLL_INTERVAL_MS = 2000;

const RUN: EvaluationRunListItemDto = {
  id: "run-1",
  status: "running",
  scope: null,
  fileName: "database: all transactions",
  rowsTotal: 10,
  rowsImported: 10,
  txProcessed: 0,
  txPassed: 0,
  txFlagged: 0,
  txError: 0,
  hitThreshold: 50,
  createdBy: "user-1",
  createdAt: "2026-10-19T10:00:00.000Z",
  finishedAt: null,
  errorMessage: null,
};

function runSummary(overrides: Partial<EvaluationRunListItemDto>) {
  return { run: { ...RUN, ...overrides }, ruleVersions: [] };
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiModeProvider>
          <MockUsageProvider>{children}</MockUsageProvider>
        </ApiModeProvider>
      </QueryClientProvider>
    );
  };
}

function countRunDetailRequests(): number {
  return requestJsonMock.mock.calls.filter(([options]) => options.path === "/evaluation-runs/run-1").length;
}

async function advancePolling(): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
  forgetSelectedApiModeForTests();
  requestJsonMock.mockReset();
});

afterEach(() => jest.useRealTimers());

describe("findProcessingPollInterval", () => {
  const batch = (status: Batch["status"]) => ({ status }) as Batch;

  it("polls while any batch is processing, faster on the mock", () => {
    expect(findProcessingPollInterval([batch("completed"), batch("processing")], "live")).toBe(2000);
    expect(findProcessingPollInterval([batch("processing")], "mock")).toBe(400);
  });

  it("stops once every batch is completed or failed, or nothing is loaded", () => {
    expect(findProcessingPollInterval([batch("completed"), batch("failed")], "live")).toBe(false);
    expect(findProcessingPollInterval(undefined, "live")).toBe(false);
  });
});

describe("live run polling", () => {
  it("starts a full run with an empty scope", async () => {
    requestJsonMock.mockImplementation(async ({ method = "GET" }) =>
      method === "POST" ? { id: "run-1" } : runSummary({}),
    );
    const { result } = renderHook(useStartEvaluationRun, { wrapper: createWrapper() });

    let startedBatch: Batch | undefined;
    await act(async () => {
      startedBatch = await result.current.mutateAsync({});
    });

    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/evaluation-runs", method: "POST" }),
    );
    expect(startedBatch).toMatchObject({ id: "run-1", status: "processing" });
  });

  it("refetches a running run until it completes, then stops", async () => {
    requestJsonMock
      .mockResolvedValueOnce(runSummary({ status: "running", txProcessed: 3 }))
      .mockResolvedValueOnce(runSummary({ status: "running", txProcessed: 7 }))
      .mockResolvedValue(runSummary({ status: "completed", txProcessed: 10, txPassed: 9, txFlagged: 1 }));
    const { result } = renderHook(() => useBatch("run-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.processedRowCount).toBe(3));
    await advancePolling();
    expect(result.current.data?.processedRowCount).toBe(7);
    await advancePolling();
    expect(result.current.data).toMatchObject({ status: "completed", processedRowCount: 10 });

    const requestsWhenCompleted = countRunDetailRequests();
    await advancePolling();
    await advancePolling();
    expect(countRunDetailRequests()).toBe(requestsWhenCompleted);
  });

  it("stops polling a failed run and keeps its reason", async () => {
    requestJsonMock
      .mockResolvedValueOnce(runSummary({ status: "importing" }))
      .mockResolvedValue(runSummary({ status: "failed", errorMessage: "Rule engine crashed" }));
    const { result } = renderHook(() => useBatch("run-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.status).toBe("processing"));
    await advancePolling();
    expect(result.current.data).toMatchObject({ status: "failed", failureReason: "Rule engine crashed" });

    const requestsWhenFailed = countRunDetailRequests();
    await advancePolling();
    expect(countRunDetailRequests()).toBe(requestsWhenFailed);
  });

  it("refreshes the batch list while a run is processing", async () => {
    requestJsonMock
      .mockResolvedValueOnce({ items: [{ ...RUN, status: "running" }], total: 1 })
      .mockResolvedValue({ items: [{ ...RUN, status: "completed" }], total: 1 });
    const { result } = renderHook(useBatches, { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.[0]?.status).toBe("processing"));
    await advancePolling();
    expect(result.current.data?.[0]?.status).toBe("completed");

    const listRequests = requestJsonMock.mock.calls.length;
    await advancePolling();
    expect(requestJsonMock.mock.calls.length).toBe(listRequests);
  });
});
