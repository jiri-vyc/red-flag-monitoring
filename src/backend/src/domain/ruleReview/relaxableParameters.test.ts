import { DEFAULT_FEATURE_PARAMETERS } from "../features/featureParameters";
import {
  type ConditionParameter,
  listRelaxableParameters,
  listRelaxationSteps,
  relaxDefinition,
} from "./relaxableParameters";
import { DEFAULT_RULE_REVIEW_PARAMS } from "./ruleReviewParams";
import { buildRuleVersion, compare } from "./testing/ruleReviewTestData";

const CAPS = DEFAULT_RULE_REVIEW_PARAMS.caps;

const PASSTHROUGH_RULE = buildRuleVersion("R-04", {
  match: "all",
  features: ["passthrough_in_24h_czk", "passthrough_out_6h_czk", "passthrough_ratio"],
  conditions: [compare("a", "passthrough_ratio", ">=", { value: 0.8 })],
});

const MIXED_RULE = buildRuleVersion("R-07", {
  match: "all",
  features: [
    "tx_type",
    "payee_small_out_count_7d",
    "payee_small_out_sum_7d_czk",
    "month_tx_count",
    "client_q2_monthly_avg_tx_count",
  ],
  conditions: [
    compare("a", "tx_type", "=", { value: "outgoing" }),
    compare("b", "payee_small_out_sum_7d_czk", ">=", { value: 25_000 }),
    {
      id: "g",
      label: "Skupina",
      match: "any",
      conditions: [
        compare("g1", "payee_small_out_count_7d", ">=", { value: 3 }),
        compare("g2", "month_tx_count", ">", { expr: "5 × client_q2_monthly_avg_tx_count" }),
      ],
    },
  ],
});

function listParameters(ruleVersion = MIXED_RULE) {
  return listRelaxableParameters({ ruleVersion, featureParameters: DEFAULT_FEATURE_PARAMETERS, caps: CAPS });
}

function findConditionParameter(conditionId: string): ConditionParameter {
  const parameter = listParameters().find(
    (candidate): candidate is ConditionParameter =>
      candidate.source === "condition" && candidate.conditionId === conditionId,
  );

  if (!parameter) {
    throw new Error(`No parameter for condition ${conditionId}`);
  }

  return parameter;
}

describe("listRelaxableParameters", () => {
  it("types DSL constants by the unit of the compared feature and never relaxes categorical values", () => {
    const parameters = listParameters().map(({ key, parameterType, direction }) => ({
      key,
      parameterType,
      direction,
    }));

    expect(parameters).toEqual([
      { key: "condition:b", parameterType: "amount", direction: "decrease" },
      { key: "condition:g1", parameterType: "count", direction: "decrease" },
      { key: "condition:g2", parameterType: "ratio", direction: "decrease" },
      { key: "feature:smallPaymentWindowDays", parameterType: "window", direction: "increase" },
    ]);
  });

  it("adds the feature parameters of the pattern features the rule reads", () => {
    expect(listParameters(PASSTHROUGH_RULE).map((parameter) => parameter.key)).toEqual([
      "condition:a",
      "feature:passthroughInflowWindowHours",
      "feature:passthroughOutflowWindowHours",
      "feature:passthroughMinInflowCzk",
    ]);
  });

  it("marks a regulatory constant from the caps", () => {
    expect(findConditionParameter("b").isRegulatory).toBe(true);
    expect(findConditionParameter("g1").isRegulatory).toBe(false);
  });
});

describe("listRelaxationSteps", () => {
  it("moves an amount in 2.5 % steps up to 10 %", () => {
    expect(listRelaxationSteps(findConditionParameter("b"), CAPS)).toEqual([
      { step: 0.025, value: 24_375 },
      { step: 0.05, value: 23_750 },
      { step: 0.075, value: 23_125 },
      { step: 0.1, value: 22_500 },
    ]);
  });

  it("widens a window in 5 % steps up to 25 %", () => {
    const window = listParameters(PASSTHROUGH_RULE).find(
      (parameter) => parameter.key === "feature:passthroughOutflowWindowHours",
    );

    expect(window && listRelaxationSteps(window, CAPS).map((step) => step.value)).toEqual([
      6.3, 6.6, 6.9, 7.2, 7.5,
    ]);
  });

  it("moves a count by one unit, never to a trivially true threshold", () => {
    const countOfOne = listParameters(
      buildRuleVersion("R-11", {
        match: "all",
        features: ["quick_forward_match_count"],
        conditions: [compare("a", "quick_forward_match_count", ">=", { value: 1 })],
      }),
    ).find((parameter) => parameter.key === "condition:a");

    expect(listRelaxationSteps(findConditionParameter("g1"), CAPS)).toEqual([{ step: 0.3333, value: 2 }]);
    expect(countOfOne && listRelaxationSteps(countOfOne, CAPS)).toEqual([]);
  });

  it("moves a tenure in months by one whole month", () => {
    const tenure = listParameters(
      buildRuleVersion("R-15", {
        match: "all",
        features: ["client_tenure_months_at_tx"],
        conditions: [compare("d", "client_tenure_months_at_tx", "<", { value: 6 })],
      }),
    ).find((parameter) => parameter.key === "condition:d");

    expect(tenure?.parameterType).toBe("count");
    expect(tenure && listRelaxationSteps(tenure, CAPS)).toEqual([{ step: 0.1667, value: 7 }]);
  });
});

describe("relaxDefinition", () => {
  it("replaces a value or a multiplier in a nested condition and nothing else", () => {
    const relaxed = relaxDefinition(
      relaxDefinition(MIXED_RULE.definition, findConditionParameter("b"), 23_750),
      findConditionParameter("g2"),
      4.875,
    );

    expect(relaxed.conditions[1]).toMatchObject({ id: "b", right: { value: 23_750 } });
    expect(relaxed.conditions[2]).toMatchObject({
      conditions: [
        { id: "g1", right: { value: 3 } },
        { id: "g2", right: { expr: "4.875 × client_q2_monthly_avg_tx_count" } },
      ],
    });
    expect(MIXED_RULE.definition.conditions[1]).toMatchObject({ right: { value: 25_000 } });
  });
});
