import type { Client } from "./client";
import type { DeterministicRunRuleVersion, RunRuleSet } from "./evaluateTransaction";
import { buildClient, buildTransaction, CLIENT_ID } from "./features/testing/featureTestData";
import type { Transaction } from "./transaction";
import { createTransactionEvaluator, TransactionNotInDatasetError } from "./transactionEvaluator";

const LARGE_PAYMENT_ID = "TX000000001";
const SMALL_PAYMENT_ID = "TX000000002";
const EUR_PAYMENT_ID = "TX000000003";

const LARGE_AMOUNT_RULE: DeterministicRunRuleVersion = {
  ruleVersionId: "rule-version-large",
  ruleId: "rule-large",
  ruleCode: "R-LARGE",
  isWhitelistAllowed: true,
  definition: {
    match: "all",
    features: ["tx_amount_czk"],
    conditions: [
      {
        id: "a",
        label: "Částka > 100 000",
        left: { feature: "tx_amount_czk" },
        op: ">",
        right: { value: 100000 },
      },
    ],
  },
  baseScore: 80,
  sensitivity: 100,
  riskProfiles: ["low", "medium", "high"],
};

const HIGH_RISK_COUNTRY_RULE: DeterministicRunRuleVersion = {
  ...LARGE_AMOUNT_RULE,
  ruleVersionId: "rule-version-hrj",
  ruleId: "rule-hrj",
  ruleCode: "R-HRJ",
  definition: {
    match: "all",
    features: ["tx_payee_country"],
    conditions: [
      {
        id: "a",
        label: "Příjemce v HRJ",
        left: { feature: "tx_payee_country" },
        op: "in",
        right: { list: "HRJ" },
      },
    ],
  },
};

const TRANSACTIONS: Transaction[] = [
  buildTransaction({ transactionId: LARGE_PAYMENT_ID, amount: "150000.00" }),
  buildTransaction({ transactionId: SMALL_PAYMENT_ID, amount: "1000.00" }),
  buildTransaction({ transactionId: EUR_PAYMENT_ID, amount: "10.00", currency: "EUR" }),
];

function buildRuleSet(overrides: Partial<RunRuleSet> = {}): RunRuleSet {
  return {
    ruleVersions: [LARGE_AMOUNT_RULE],
    referenceLists: new Map([["HRJ", ["IR"]]]),
    whitelistedClientIdsByRuleId: new Map(),
    hitThreshold: 50,
    ...overrides,
  };
}

function evaluate(input: { transactionId: string; ruleSet?: RunRuleSet; client?: Client }) {
  const evaluateTransaction = createTransactionEvaluator({
    dataset: {
      clients: [input.client ?? buildClient()],
      transactions: TRANSACTIONS.filter((transaction) => transaction.currency === "CZK"),
      fxRates: [],
    },
    ruleSet: input.ruleSet ?? buildRuleSet(),
  });

  return evaluateTransaction(input.transactionId);
}

describe("createTransactionEvaluator", () => {
  it("flags a transaction whose rule scores at least the hit threshold", () => {
    const evaluation = evaluate({ transactionId: LARGE_PAYMENT_ID });

    expect(evaluation).toMatchObject({
      verdict: "flagged",
      maxScore: 80,
      hitCount: 1,
      clientRiskProfile: "low",
    });
    expect(evaluation.ruleEvaluations[0]).toMatchObject({
      outcome: "hit",
      rawScore: 80,
      adjustedScore: 80,
      contextRefs: [LARGE_PAYMENT_ID],
    });
  });

  it("passes a transaction that matches no condition and keeps its trace without context refs", () => {
    const evaluation = evaluate({ transactionId: SMALL_PAYMENT_ID });

    expect(evaluation).toMatchObject({ verdict: "pass", maxScore: 0, hitCount: 0 });
    expect(evaluation.ruleEvaluations[0]).toMatchObject({ outcome: "pass", rawScore: 0, contextRefs: [] });
    expect(evaluation.ruleEvaluations[0]?.trace).toMatchObject({ matched: false });
  });

  it("lowers the score by the sensitivity, so a match under the threshold passes", () => {
    const ruleSet = buildRuleSet({ ruleVersions: [{ ...LARGE_AMOUNT_RULE, sensitivity: 50 }] });

    const evaluation = evaluate({ transactionId: LARGE_PAYMENT_ID, ruleSet });

    expect(evaluation.verdict).toBe("pass");
    expect(evaluation.ruleEvaluations[0]).toMatchObject({ outcome: "pass", rawScore: 80, adjustedScore: 40 });
  });

  it("skips a whitelisted client", () => {
    const ruleSet = buildRuleSet({
      whitelistedClientIdsByRuleId: new Map([[LARGE_AMOUNT_RULE.ruleId, new Set([CLIENT_ID])]]),
    });

    const evaluation = evaluate({ transactionId: LARGE_PAYMENT_ID, ruleSet });

    expect(evaluation.verdict).toBe("pass");
    expect(evaluation.ruleEvaluations[0]).toMatchObject({
      outcome: "not_applicable",
      skipReason: "whitelist",
    });
  });

  it("ignores a whitelist entry of a rule that does not allow one", () => {
    const ruleSet = buildRuleSet({
      ruleVersions: [{ ...LARGE_AMOUNT_RULE, isWhitelistAllowed: false }],
      whitelistedClientIdsByRuleId: new Map([[LARGE_AMOUNT_RULE.ruleId, new Set([CLIENT_ID])]]),
    });

    expect(evaluate({ transactionId: LARGE_PAYMENT_ID, ruleSet }).verdict).toBe("flagged");
  });

  it("skips a client whose risk profile the rule version does not cover", () => {
    const ruleSet = buildRuleSet({ ruleVersions: [{ ...LARGE_AMOUNT_RULE, riskProfiles: ["high"] }] });

    const evaluation = evaluate({ transactionId: LARGE_PAYMENT_ID, ruleSet });

    expect(evaluation.ruleEvaluations[0]).toMatchObject({
      outcome: "not_applicable",
      skipReason: "risk_profile",
    });
  });

  it("records a rule error and keeps evaluating the other rules", () => {
    const ruleSet = buildRuleSet({ ruleVersions: [HIGH_RISK_COUNTRY_RULE], referenceLists: new Map() });

    const evaluation = evaluate({ transactionId: LARGE_PAYMENT_ID, ruleSet });

    expect(evaluation.verdict).toBe("error");
    expect(evaluation.ruleEvaluations[0]).toMatchObject({ outcome: "error", rawScore: null });
    expect(evaluation.ruleEvaluations[0]?.errorMessage).toContain("HRJ");
  });

  it("prefers flagged over error when one rule hits and another fails", () => {
    const ruleSet = buildRuleSet({
      ruleVersions: [LARGE_AMOUNT_RULE, HIGH_RISK_COUNTRY_RULE],
      referenceLists: new Map(),
    });

    expect(evaluate({ transactionId: LARGE_PAYMENT_ID, ruleSet })).toMatchObject({
      verdict: "flagged",
      hitCount: 1,
    });
  });

  it("fails every rule of a client whose history has a transaction without an FX rate", () => {
    const evaluateTransaction = createTransactionEvaluator({
      dataset: { clients: [buildClient()], transactions: TRANSACTIONS, fxRates: [] },
      ruleSet: buildRuleSet(),
    });

    const evaluation = evaluateTransaction(SMALL_PAYMENT_ID);

    expect(evaluation.verdict).toBe("error");
    expect(evaluation.ruleEvaluations[0]?.errorMessage).toContain("EUR");
  });

  it("throws for a transaction that is not in the dataset", () => {
    expect(() => evaluate({ transactionId: "TX999999999" })).toThrow(TransactionNotInDatasetError);
  });
});
