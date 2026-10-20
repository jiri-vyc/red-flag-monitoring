import { DEFAULT_FEATURE_PARAMETERS } from "../features/featureParameters";
import { calculateAllowedGrowth, type NearMiss, summarizeSweep, toSweepFinding } from "./parameterSweep";
import { listRelaxableParameters, listRelaxationSteps } from "./relaxableParameters";
import { DEFAULT_RULE_REVIEW_PARAMS } from "./ruleReviewParams";
import { AMOUNT_RULE, buildRuleVersion, compare } from "./testing/ruleReviewTestData";

const { caps, growthCap } = DEFAULT_RULE_REVIEW_PARAMS;
const [AMOUNT_PARAMETER] = listRelaxableParameters({
  ruleVersion: AMOUNT_RULE,
  featureParameters: DEFAULT_FEATURE_PARAMETERS,
  caps,
});

function nearMiss(clientId: string, stepIndex: number, dateKey = "2026-07-01"): NearMiss {
  return {
    clientId,
    transactionId: `${clientId}-${dateKey}-${stepIndex}`,
    dateKey,
    stepIndex,
    distance: 0.02 * (stepIndex + 1),
    observedValue: 100_000 * (1 - 0.02 * (stepIndex + 1)),
  };
}

function sweep(nearMisses: NearMiss[], baseClientIds: string[] = []) {
  if (!AMOUNT_PARAMETER) {
    throw new Error("The amount rule has no parameter");
  }

  return summarizeSweep({
    ruleVersion: AMOUNT_RULE,
    parameter: AMOUNT_PARAMETER,
    steps: listRelaxationSteps(AMOUNT_PARAMETER, caps),
    baseClientIds: new Set(baseClientIds),
    nearMisses,
    caps,
    growthCap,
  });
}

describe("calculateAllowedGrowth", () => {
  it("allows max(5, 25 % of the base) and never more than 50", () => {
    expect(calculateAllowedGrowth(3, growthCap)).toBe(5);
    expect(calculateAllowedGrowth(33, growthCap)).toBe(8);
    expect(calculateAllowedGrowth(3033, growthCap)).toBe(50);
  });
});

describe("summarizeSweep", () => {
  it("reports the smallest step that adds clients and ignores clients the rule already hits", () => {
    const result = sweep(
      [nearMiss("K1", 1), nearMiss("K1", 1, "2026-07-02"), nearMiss("K2", 3), nearMiss("BASE", 0)],
      ["BASE"],
    );

    expect(result.steps.map((step) => step.addedClients)).toEqual([0, 1, 1, 2]);
    expect(result).toMatchObject({ reportedStepIndex: 1, outcome: "gap" });
    expect(result.clients).toEqual([
      expect.objectContaining({ clientId: "K1", nearMissCount: 2, distinctDays: 2, minDistance: 0.04 }),
    ]);
  });

  it("treats a single near miss of a single client as noise (3.3)", () => {
    expect(sweep([nearMiss("K1", 0)]).outcome).toBe("noise");
  });

  it("counts several clients under one parameter as a gap even without repetition", () => {
    expect(sweep([nearMiss("K1", 0), nearMiss("K2", 0), nearMiss("K3", 0)]).outcome).toBe("gap");
  });

  it("calls a first step that breaks the growth cap a recalibration with no client list", () => {
    const result = sweep(Array.from({ length: 6 }, (_, index) => nearMiss(`K${index}`, 0)));

    expect(result).toMatchObject({ outcome: "cap_exceeded", clients: [] });
  });

  it("finds nothing without near misses", () => {
    expect(sweep([]).outcome).toBe("no_gap");
  });
});

describe("toSweepFinding", () => {
  it("proposes the reported step as a rule adjustment", () => {
    const finding = toSweepFinding(
      sweep([nearMiss("K1", 1), nearMiss("K1", 1, "2026-07-02")]),
      "Velká částka",
      () => null,
    );

    expect(finding?.evidence).toMatchObject({
      addedHits: 2,
      traceExcerpts: [
        { clientId: "K1", transactionId: "K1-2026-07-01-1", observedValue: 96_000, distance: 0.04 },
      ],
    });
    expect(finding).toMatchObject({
      id: "R-AMT:condition:a",
      kind: "rule_adjustment",
      rule: { code: "R-AMT", label: "Velká částka" },
      proposal: {
        parameter: "condition:a",
        parameterType: "amount",
        currentValue: 100_000,
        proposedValue: 95_000,
        step: 0.05,
      },
      growth: { baseClients: 0, addedClients: 1, capExceeded: false },
    });
  });

  it("writes a recalibration without a proposal", () => {
    const finding = toSweepFinding(
      sweep(Array.from({ length: 6 }, (_, index) => nearMiss(`K${index}`, 0))),
      "Velká částka",
      () => null,
    );

    expect(finding).toMatchObject({
      proposal: null,
      growth: { addedClients: 6, capExceeded: true },
      clients: [],
    });
    expect(finding?.evidence).toMatchObject({ reason: "growth cap exceeded" });
  });

  it("proposes a regulatory parameter only as a new rule with the relaxed definition", () => {
    const regulatoryRule = buildRuleVersion("R-07", {
      match: "all",
      features: ["payee_small_out_sum_7d_czk"],
      conditions: [compare("b", "payee_small_out_sum_7d_czk", ">=", { value: 25_000 })],
    });
    const [parameter] = listRelaxableParameters({
      ruleVersion: regulatoryRule,
      featureParameters: DEFAULT_FEATURE_PARAMETERS,
      caps,
    });

    if (!parameter) {
      throw new Error("R-07 has no parameter");
    }

    const result = summarizeSweep({
      ruleVersion: regulatoryRule,
      parameter,
      steps: listRelaxationSteps(parameter, caps),
      baseClientIds: new Set(),
      nearMisses: [nearMiss("K1", 0), nearMiss("K2", 0), nearMiss("K3", 0)],
      caps,
      growthCap,
    });
    const definition = { ...regulatoryRule.definition, features: ["relaxed"] };

    expect(toSweepFinding(result, "Řada malých plateb", () => ({ definition }))).toMatchObject({
      kind: "new_rule",
      proposal: { definition },
    });
  });
});
