import { evaluateRuleDefinition } from "../ruleConditionEvaluation";
import type { RuleDefinition } from "../ruleDefinition";
import { measureConditionMargin, measureDistanceToFiring } from "./traceMargins";
import { compare } from "./testing/ruleReviewTestData";

const DEFINITION: RuleDefinition = {
  match: "all",
  features: ["tx_amount_czk", "tx_type", "month_tx_count", "client_q2_monthly_avg_tx_count"],
  conditions: [
    compare("a", "tx_amount_czk", ">", { value: 100_000 }),
    {
      id: "b",
      label: "Skupina",
      match: "any",
      conditions: [
        compare("b1", "tx_type", "=", { value: "remittance" }),
        compare("b2", "month_tx_count", ">", { expr: "5 × client_q2_monthly_avg_tx_count" }),
      ],
    },
  ],
};

const FEATURES = {
  tx_amount_czk: 95_000,
  tx_type: "outgoing",
  month_tx_count: 45,
  client_q2_monthly_avg_tx_count: 10,
};

describe("trace margins", () => {
  it("takes the largest distance of an `all` group and the smallest of an `any` group", () => {
    const trace = evaluateRuleDefinition({
      definition: DEFINITION,
      features: FEATURES,
      referenceLists: new Map(),
    });

    // a: 5 % below 100 000; b: text is unreachable, the multiplier must drop from 5 to 4.5 (10 %).
    expect(measureDistanceToFiring(trace, FEATURES)).toBe(0.1);
  });

  it("measures one condition's margin and reports an unreachable one as null", () => {
    const input = { definition: DEFINITION, features: FEATURES, referenceLists: new Map() };

    expect(measureConditionMargin({ ...input, conditionId: "a" })).toEqual({
      distance: 0.05,
      observedValue: 95_000,
    });
    expect(measureConditionMargin({ ...input, conditionId: "b2" })).toEqual({
      distance: 0.1,
      observedValue: 45,
    });
    expect(measureConditionMargin({ ...input, conditionId: "b1" })).toEqual({
      distance: null,
      observedValue: null,
    });
  });

  it("is zero for a satisfied condition", () => {
    const input = {
      definition: DEFINITION,
      features: { ...FEATURES, tx_amount_czk: 120_000 },
      referenceLists: new Map(),
    };

    expect(measureConditionMargin({ ...input, conditionId: "a" }).distance).toBe(0);
  });
});
