import { ruleDetailPath } from "./rulePaths";

describe("ruleDetailPath", () => {
  it("links to the rule detail", () => {
    expect(ruleDetailPath("rule-1")).toBe("/rules/rule-1");
  });

  it("encodes the rule ID", () => {
    expect(ruleDetailPath("a/b?c#d")).toBe("/rules/a%2Fb%3Fc%23d");
  });
});
