import { buildClient, buildOutgoing } from "../features/testing/featureTestData";
import type { Transaction } from "../transaction";
import { runToCompletion } from "./cooperativeWork";
import { backtestRuleDefinition } from "./ruleBacktest";
import { DEFAULT_RULE_REVIEW_PARAMS } from "./ruleReviewParams";
import { AMOUNT_RULE, buildReviewDataset, buildRuleSet, compare } from "./testing/ruleReviewTestData";

const clients = Array.from({ length: 200 }, (_, index) =>
  buildClient({ clientId: `K${index}`, amlRiskScore: index % 2 === 0 ? "high" : "low" }),
);

function payment(clientId: string, amount: number): Transaction {
  return { ...buildOutgoing({ id: `${clientId}-1`, at: "2026-07-01 09:00", amount, payee: "A" }), clientId };
}

const dataset = buildReviewDataset(clients, [
  payment("K0", 150_000),
  payment("K1", 150_000),
  ...clients.slice(2).map((client) => payment(client.clientId, 1_000)),
]);

function backtest(threshold: number, clientIdsByRuleCode = new Map<string, Set<string>>()) {
  const { backtest: result } = runToCompletion(
    backtestRuleDefinition({
      dataset,
      definition: {
        match: "all",
        features: ["tx_amount_czk"],
        conditions: [compare("a", "tx_amount_czk", ">", { value: threshold })],
      },
      ruleSet: buildRuleSet([]),
      clientIdsByRuleCode,
      caps: DEFAULT_RULE_REVIEW_PARAMS.backtest,
      maxSampleClientIds: 10,
    }),
  );

  return result;
}

describe("backtestRuleDefinition", () => {
  it("keeps the hit transactions per client for the finding", () => {
    const { transactionIdsByClientId } = runToCompletion(
      backtestRuleDefinition({
        dataset,
        definition: {
          match: "all",
          features: ["tx_amount_czk"],
          conditions: [compare("a", "tx_amount_czk", ">", { value: 100_000 })],
        },
        ruleSet: buildRuleSet([]),
        clientIdsByRuleCode: new Map(),
        caps: DEFAULT_RULE_REVIEW_PARAMS.backtest,
        maxSampleClientIds: 10,
      }),
    );

    expect([...transactionIdsByClientId]).toEqual([
      ["K0", ["K0-1"]],
      ["K1", ["K1-1"]],
    ]);
  });

  it("counts hits, clients and their risk scores", () => {
    expect(backtest(100_000)).toMatchObject({
      violation: null,
      hitCount: 2,
      clientCount: 2,
      clientShare: 0.01,
      clientsByRiskScore: { high: 1, low: 1, medium: 0 },
      sampleClientIds: ["K0", "K1"],
      discardReason: null,
    });
  });

  it("discards a rule that mostly overlaps an existing one", () => {
    const result = backtest(100_000, new Map([[AMOUNT_RULE.ruleCode, new Set(["K0", "K1"])]]));

    expect(result.maxOverlap).toEqual({ ruleCode: "R-AMT", share: 1 });
    expect(result.discardReason).toContain("already hit by R-AMT");
  });

  it("discards a rule above the client cap", () => {
    expect(backtest(500).discardReason).toBe("Hits 200 clients, more than the cap of 2");
  });

  it("discards a definition that fails DSL validation without evaluating it", () => {
    const { backtest: result } = runToCompletion(
      backtestRuleDefinition({
        dataset,
        definition: { match: "all", features: ["no_such_feature"], conditions: [] },
        ruleSet: buildRuleSet([]),
        clientIdsByRuleCode: new Map(),
        caps: DEFAULT_RULE_REVIEW_PARAMS.backtest,
        maxSampleClientIds: 10,
      }),
    );

    expect(result).toMatchObject({
      violation: "Feature no_such_feature is not in the feature catalogue",
      hitCount: 0,
    });
    expect(result.discardReason).toContain("DSL validation failed");
  });
});
