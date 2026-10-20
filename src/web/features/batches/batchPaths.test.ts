import { batchPath, batchTransactionPath, findStartedRunPath, parseBucketParam } from "./batchPaths";
import { DEFAULT_BUCKET } from "./types";

describe("batchPath", () => {
  it("links to the batch detail", () => {
    expect(batchPath("batch-1")).toBe("/batches/batch-1");
  });

  it("adds the selected bucket", () => {
    expect(batchPath("batch-1", "to_check")).toBe("/batches/batch-1?bucket=to_check");
  });

  it("encodes the batch ID", () => {
    expect(batchPath("a/b?c#d", "alert")).toBe("/batches/a%2Fb%3Fc%23d?bucket=alert");
  });
});

describe("batchTransactionPath", () => {
  it("links to the transaction detail with both IDs encoded", () => {
    expect(batchTransactionPath("batch 1", "tx/42")).toBe("/batches/batch%201/transactions/tx%2F42");
  });
});

describe("parseBucketParam", () => {
  it("keeps an explicit bucket", () => {
    expect(parseBucketParam("ok")).toBe("ok");
    expect(parseBucketParam("to_check")).toBe("to_check");
  });

  it("falls back to alerts when the bucket is missing or invalid", () => {
    expect(DEFAULT_BUCKET).toBe("alert");
    expect(parseBucketParam(undefined)).toBe(DEFAULT_BUCKET);
    expect(parseBucketParam("unknown")).toBe(DEFAULT_BUCKET);
    expect(parseBucketParam(["ok", "alert"])).toBe(DEFAULT_BUCKET);
  });
});

describe("findStartedRunPath", () => {
  it("opens the run detail when the data source is unchanged", () => {
    expect(findStartedRunPath({ batchId: "run-1", submittedMode: "live", activeMode: "live" })).toBe(
      "/batches/run-1",
    );
  });

  it("stays on the list when the data source was switched during the start", () => {
    expect(findStartedRunPath({ batchId: "run-1", submittedMode: "live", activeMode: "mock" })).toBeNull();
  });
});
