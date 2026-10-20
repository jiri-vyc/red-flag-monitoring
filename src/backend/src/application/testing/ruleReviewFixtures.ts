import { buildClient, buildIncoming, buildOutgoing } from "../../domain/features/testing/featureTestData";
import { AMOUNT_RULE, buildRuleSet } from "../../domain/ruleReview/testing/ruleReviewTestData";
import type { Transaction } from "../../domain/transaction";
import type { RuleReviewInputRepository } from "../ruleReviews/ruleReviewPorts";

function forClient(clientId: string, transaction: Transaction): Transaction {
  return { ...transaction, clientId, transactionId: `${clientId}-${transaction.transactionId}` };
}

export const NEAR_MISS_CLIENT_IDS = ["K1", "K2", "K3"];
// Clients without transactions, so the 1 % backtest cap allows four.
const INACTIVE_CLIENT_IDS = Array.from({ length: 400 }, (_, index) => `KX${index}`);

export function createFakeRuleReviewInputRepository(): RuleReviewInputRepository {
  const transactions = [
    forClient("K0", buildOutgoing({ id: "1", at: "2026-07-01 09:00", amount: 150_000, payee: "A" })),
    ...NEAR_MISS_CLIENT_IDS.map((clientId) =>
      forClient(clientId, buildOutgoing({ id: "1", at: "2026-07-02 09:00", amount: 97_000, payee: "A" })),
    ),
    forClient("K4", buildIncoming({ id: "1", at: "2026-07-03 09:00", amount: 1_000, payer: "B" })),
  ];

  return {
    loadRuleSet: () =>
      Promise.resolve({
        ruleSet: buildRuleSet([AMOUNT_RULE]),
        ruleVersionIds: [AMOUNT_RULE.ruleVersionId],
        referenceListVersionIds: [],
      }),
    loadRuleCatalogue: () =>
      Promise.resolve([
        {
          ruleId: AMOUNT_RULE.ruleId,
          ruleVersionId: AMOUNT_RULE.ruleVersionId,
          code: AMOUNT_RULE.ruleCode,
          label: "Velká platba",
          alertType: "large_payment",
          humanText: "Velká platba. Pravidlo zasáhne platbu aspoň 100 000 CZK.",
          legalBases: [],
        },
      ]),
    loadDataset: () =>
      Promise.resolve({
        clients: ["K0", "K4", ...NEAR_MISS_CLIENT_IDS, ...INACTIVE_CLIENT_IDS].map((clientId) =>
          buildClient({ clientId }),
        ),
        transactions,
        fxRates: [],
      }),
    listTransactionIds: () => Promise.resolve(transactions.map((transaction) => transaction.transactionId)),
  };
}
