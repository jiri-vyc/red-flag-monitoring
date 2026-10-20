import { MAX_RUN_LIMIT, parseRunLimit } from "./runScope";

describe("parseRunLimit", () => {
  it("leaves an empty field out of the scope", () => {
    expect(parseRunLimit("")).toBeUndefined();
    expect(parseRunLimit("  ")).toBeUndefined();
  });

  it("accepts a whole number from 1 to the maximum", () => {
    expect(parseRunLimit("1")).toBe(1);
    expect(parseRunLimit("1000")).toBe(1000);
    expect(parseRunLimit(String(MAX_RUN_LIMIT))).toBe(MAX_RUN_LIMIT);
  });

  it.each(["0", "-5", "1.5", "abc", "Infinity", String(MAX_RUN_LIMIT + 1), "1e20"])("rejects %s", (limit) => {
    expect(parseRunLimit(limit)).toBeNull();
  });
});
