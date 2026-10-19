import type { RuleCondition, RuleDefinition } from "./ruleDefinition";
import { findRuleDefinitionViolation } from "./ruleDefinitionValidation";

function buildDefinition(
  condition: RuleCondition,
  features: string[] = ["tx_amount_czk", "tx_payee_country"],
): RuleDefinition {
  return { match: "all", features, conditions: [condition] };
}

describe("findRuleDefinitionViolation", () => {
  it("accepts conditions over catalogue features", () => {
    const definition = buildDefinition(
      {
        id: "a",
        label: "a",
        left: { feature: "tx_amount_czk" },
        op: ">",
        right: { expr: "2 × client_q2_max_tx_czk" },
      },
      ["tx_amount_czk", "client_q2_max_tx_czk"],
    );

    expect(findRuleDefinitionViolation(definition)).toBeNull();
  });

  it.each<[string, RuleDefinition, string]>([
    [
      "an unknown feature",
      buildDefinition(
        { id: "a", label: "a", left: { feature: "amount_czk" }, op: ">", right: { value: 1 } },
        ["amount_czk"],
      ),
      "not in the feature catalogue",
    ],
    [
      "a feature missing from definition.features",
      buildDefinition({
        id: "a",
        label: "a",
        left: { feature: "client_is_pep" },
        op: "=",
        right: { value: true },
      }),
      "missing from definition.features",
    ],
    [
      "an expression other than number × feature",
      buildDefinition({
        id: "a",
        label: "a",
        left: { feature: "tx_amount_czk" },
        op: ">",
        right: { expr: "tx_amount_czk / 2" },
      }),
      "must have the form",
    ],
    [
      "in without a reference list",
      buildDefinition({
        id: "a",
        label: "a",
        left: { feature: "tx_payee_country" },
        op: "in",
        right: { value: "IR" },
      }),
      "need a reference list",
    ],
    [
      "a reference list on the left",
      buildDefinition({ id: "a", label: "a", left: { list: "HRJ" }, op: "in", right: { list: "HRJ" } }),
      "only be the right operand",
    ],
  ])("rejects %s", (_case, definition, expectedMessage) => {
    expect(findRuleDefinitionViolation(definition)).toContain(expectedMessage);
  });
});
