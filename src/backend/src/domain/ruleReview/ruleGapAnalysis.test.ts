import { DEFAULT_FEATURE_PARAMETERS } from "../features/featureParameters";
import { buildClient, buildIncoming, buildOutgoing } from "../features/testing/featureTestData";
import { runToCompletion } from "./cooperativeWork";
import { planFeatureSweeps, runBaselinePass, sweepFeatureParameter, toSweepKey } from "./ruleGapAnalysis";
import { DEFAULT_RULE_REVIEW_PARAMS } from "./ruleReviewParams";
import { AMOUNT_RULE, buildReviewDataset, buildRuleSet, ROUND_TRIP_RULE } from "./testing/ruleReviewTestData";

const { caps } = DEFAULT_RULE_REVIEW_PARAMS;
const featureParameters = DEFAULT_FEATURE_PARAMETERS;

describe("runBaselinePass", () => {
  const dataset = buildReviewDataset(
    [buildClient()],
    [
      buildOutgoing({ id: "HIT", at: "2026-07-01 09:00", amount: 120_000, payee: "A" }),
      buildOutgoing({ id: "NEAR", at: "2026-07-02 09:00", amount: 96_000, payee: "A" }),
      buildOutgoing({ id: "FAR", at: "2026-07-03 09:00", amount: 80_000, payee: "A" }),
    ],
  );
  const ruleSet = buildRuleSet([AMOUNT_RULE]);

  it("records today's hits and the near misses of each relaxable constant", () => {
    const baseline = runToCompletion(runBaselinePass({ dataset, ruleSet, featureParameters, caps }));

    expect([...(baseline.hitsByRuleVersionId.get(AMOUNT_RULE.ruleVersionId)?.transactionIds ?? [])]).toEqual([
      "HIT",
    ]);
    expect(baseline.conditionNearMisses.get(toSweepKey(AMOUNT_RULE.ruleVersionId, "condition:a"))).toEqual([
      {
        clientId: "K000001",
        transactionId: "NEAR",
        dateKey: "2026-07-02",
        stepIndex: 1,
        distance: 0.04,
        observedValue: 96_000,
      },
    ]);
  });

  it("skips rules excluded by the caps", () => {
    const baseline = runToCompletion(
      runBaselinePass({
        dataset,
        ruleSet,
        featureParameters,
        caps: { ...caps, excludedRuleCodes: ["R-AMT"] },
      }),
    );

    expect(baseline.conditionSweeps).toEqual([]);
  });
});

describe("sweepFeatureParameter", () => {
  it("finds a round trip just past the 72 h window at the first window step that covers it", () => {
    const dataset = buildReviewDataset(
      [buildClient()],
      [
        buildIncoming({ id: "IN", at: "2026-07-01 08:00", amount: 30_000, payer: "B" }),
        // 76 h later: outside 72 h, inside 75.6 h (5 %) no, inside 79.2 h (10 %) yes.
        buildOutgoing({ id: "OUT", at: "2026-07-04 12:00", amount: 30_000, payee: "B" }),
      ],
    );
    const ruleSet = buildRuleSet([ROUND_TRIP_RULE]);
    const [plan] = planFeatureSweeps({ ruleSet, featureParameters, caps });

    if (!plan) {
      throw new Error("R-12 has no feature parameter");
    }

    const nearMisses = runToCompletion(
      sweepFeatureParameter({ dataset, ruleSet, plan, featureParameters, baseHitTransactionIds: new Set() }),
    );

    expect(plan.parameter.key).toBe("feature:roundTripWindowHours");
    expect(nearMisses).toEqual([
      {
        clientId: "K000001",
        transactionId: "OUT",
        dateKey: "2026-07-04",
        stepIndex: 1,
        distance: 0.1,
        observedValue: null,
      },
    ]);
  });
});
