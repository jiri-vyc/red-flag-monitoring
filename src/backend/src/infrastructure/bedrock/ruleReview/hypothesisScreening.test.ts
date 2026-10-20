import { findDiscardReason, limitSampleClientIds } from "./hypothesisScreening";
import { createBacktest } from "./testing/ruleReviewTestData";

describe("findDiscardReason", () => {
  it("keeps a backtest that passed 1a's caps and hits clients", () => {
    expect(findDiscardReason(createBacktest())).toBeNull();
  });

  it("passes on 1a's discard reason", () => {
    expect(findDiscardReason(createBacktest({ discardReason: "overlaps 80 % with R-11" }))).toBe(
      "overlaps 80 % with R-11",
    );
  });

  it("discards a definition the backtest could not validate", () => {
    expect(findDiscardReason(createBacktest({ violation: "Feature x is unknown" }))).toBe(
      "DSL validation failed: Feature x is unknown",
    );
  });

  it("discards a rule that hits no client", () => {
    expect(findDiscardReason(createBacktest({ clientCount: 0 }))).toBe("the rule hits no client");
  });
});

describe("limitSampleClientIds", () => {
  it("keeps at most the given number of sample client IDs", () => {
    const backtest = createBacktest({
      sampleClientIds: Array.from({ length: 12 }, (_, index) => `K${index}`),
    });

    expect(limitSampleClientIds(backtest, 10).sampleClientIds).toHaveLength(10);
  });
});
