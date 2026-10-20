import { batchPath, batchTransactionPath } from "./batchPaths";

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
