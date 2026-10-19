import { isRuleDefinedInPolicy } from "./policyRuleSections";

const POLICY_TEXT = [
  "# SVZ-06 Směrnice o monitoringu plateb",
  "",
  "### Čl. 4 Přehled pravidel",
  "| Čl. 5 | R-07 | Řada malých plateb |",
  "",
  "### Čl. 5 R-07 Řada malých plateb stejnému příjemci",
  "**Pravidlo:** Alert vznikne, pokud …",
  "",
  "## Příloha 1",
  "### R-01 Nesoulad s profilem klienta",
].join("\n");

describe("isRuleDefinedInPolicy", () => {
  it("finds a rule that has its own article heading", () => {
    expect(isRuleDefinedInPolicy(POLICY_TEXT, "R-07")).toBe(true);
  });

  it("finds a rule whose heading starts with the rule ID", () => {
    expect(isRuleDefinedInPolicy(POLICY_TEXT, "R-01")).toBe(true);
  });

  it("ignores rule IDs mentioned only outside headings", () => {
    const tableOnlyPolicy = "### Čl. 4 Přehled pravidel\n| Čl. 5 | R-07 | Řada malých plateb |";

    expect(isRuleDefinedInPolicy(tableOnlyPolicy, "R-07")).toBe(false);
  });

  it("does not match a rule ID that only starts the same", () => {
    expect(isRuleDefinedInPolicy(POLICY_TEXT, "R-0")).toBe(false);
  });

  it("returns false for a rule the policy does not define", () => {
    expect(isRuleDefinedInPolicy(POLICY_TEXT, "R-99")).toBe(false);
  });
});
