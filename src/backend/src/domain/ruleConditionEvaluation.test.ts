import { evaluateRuleDefinition, RuleDefinitionEvaluationError } from "./ruleConditionEvaluation";
import type { RuleDefinition } from "./ruleDefinition";

const REFERENCE_LISTS = new Map([["HRJ", ["IR", "KP"]]]);

// PR-08 shape: a higher limit for everyone, a lower one for high-risk or PEP clients.
const REMITTANCE_SUM_RULE: RuleDefinition = {
  match: "any",
  features: ["month_remittance_sum_czk", "client_risk_score", "client_is_pep"],
  conditions: [
    {
      id: "a",
      label: "Součet ≥ 375 000",
      left: { feature: "month_remittance_sum_czk" },
      op: ">=",
      right: { value: 375000 },
    },
    {
      id: "b",
      label: "Rizikový klient a součet ≥ 187 500",
      match: "all",
      conditions: [
        {
          id: "b1",
          label: "Rizikový klient",
          match: "any",
          conditions: [
            {
              id: "b1a",
              label: "High",
              left: { feature: "client_risk_score" },
              op: "=",
              right: { value: "high" },
            },
            { id: "b1b", label: "PEP", left: { feature: "client_is_pep" }, op: "=", right: { value: true } },
          ],
        },
        {
          id: "b2",
          label: "Součet ≥ 187 500",
          left: { feature: "month_remittance_sum_czk" },
          op: ">=",
          right: { value: 187500 },
        },
      ],
    },
  ],
};

describe("evaluateRuleDefinition", () => {
  it.each([
    [
      "a PEP client over the lower limit",
      { month_remittance_sum_czk: 200000, client_risk_score: "low", client_is_pep: true },
      true,
    ],
    [
      "a low-risk client over the lower limit",
      { month_remittance_sum_czk: 200000, client_risk_score: "low", client_is_pep: false },
      false,
    ],
    [
      "a low-risk client over the higher limit",
      { month_remittance_sum_czk: 400000, client_risk_score: "low", client_is_pep: false },
      true,
    ],
  ])("evaluates nested groups for %s", (_case, features, expectedMatch) => {
    const trace = evaluateRuleDefinition({
      definition: REMITTANCE_SUM_RULE,
      features,
      referenceLists: REFERENCE_LISTS,
    });

    expect(trace.matched).toBe(expectedMatch);
  });

  it("keeps every nested condition and its values in the trace", () => {
    const trace = evaluateRuleDefinition({
      definition: REMITTANCE_SUM_RULE,
      features: { month_remittance_sum_czk: 200000, client_risk_score: "high", client_is_pep: false },
      referenceLists: REFERENCE_LISTS,
    });

    expect(trace.conditions[1]).toMatchObject({ id: "b", match: "all", result: true });
    expect(trace.summary).toBe("Splněno: Rizikový klient a součet ≥ 187 500.");
  });

  it("scales a feature in an expression and treats a null operand as false", () => {
    const definition: RuleDefinition = {
      match: "any",
      features: ["tx_amount_czk", "client_q2_max_tx_czk"],
      conditions: [
        {
          id: "c",
          label: "2× max Q2",
          left: { feature: "tx_amount_czk" },
          op: ">",
          right: { expr: "2 × client_q2_max_tx_czk" },
        },
      ],
    };

    const withBaseline = evaluateRuleDefinition({
      definition,
      features: { tx_amount_czk: 70000, client_q2_max_tx_czk: 30356.79 },
      referenceLists: REFERENCE_LISTS,
    });
    const withoutBaseline = evaluateRuleDefinition({
      definition,
      features: { tx_amount_czk: 70000, client_q2_max_tx_czk: null },
      referenceLists: REFERENCE_LISTS,
    });

    expect(withBaseline.conditions[0]).toMatchObject({ right: { value: 60713.58 }, result: true });
    expect(withoutBaseline.matched).toBe(false);
  });

  it("compares with a reference list", () => {
    const definition: RuleDefinition = {
      match: "all",
      features: ["tx_payee_country"],
      conditions: [
        { id: "a", label: "HRJ", left: { feature: "tx_payee_country" }, op: "in", right: { list: "HRJ" } },
      ],
    };

    expect(
      evaluateRuleDefinition({
        definition,
        features: { tx_payee_country: "IR" },
        referenceLists: REFERENCE_LISTS,
      }).matched,
    ).toBe(true);
    expect(
      evaluateRuleDefinition({
        definition,
        features: { tx_payee_country: "AT" },
        referenceLists: REFERENCE_LISTS,
      }).matched,
    ).toBe(false);
    expect(() =>
      evaluateRuleDefinition({ definition, features: { tx_payee_country: "IR" }, referenceLists: new Map() }),
    ).toThrow(RuleDefinitionEvaluationError);
  });
});
