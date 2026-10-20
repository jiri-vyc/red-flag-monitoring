import { isSafeInternalPath, readReturnPath, withReturnPath } from "./returnPath";

describe("isSafeInternalPath", () => {
  it.each(["/", "/batches/b-1/transactions/t-1", "/batches/b-1?bucket=review"])("accepts %s", (path) => {
    expect(isSafeInternalPath(path)).toBe(true);
  });

  it.each([
    "",
    "batches/b-1",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
  ])("rejects %j", (path) => {
    expect(isSafeInternalPath(path)).toBe(false);
  });
});

describe("withReturnPath", () => {
  it("encodes the return path into the query", () => {
    expect(withReturnPath("/rules/r-1", "/batches/b 1/transactions/t-1")).toBe(
      "/rules/r-1?from=%2Fbatches%2Fb%201%2Ftransactions%2Ft-1",
    );
  });
});

describe("readReturnPath", () => {
  it("returns a safe single value", () => {
    expect(readReturnPath("/batches/b-1")).toBe("/batches/b-1");
  });

  it.each([undefined, ["/a", "/b"], "//evil.example"])("returns null for %j", (value) => {
    expect(readReturnPath(value)).toBeNull();
  });
});
