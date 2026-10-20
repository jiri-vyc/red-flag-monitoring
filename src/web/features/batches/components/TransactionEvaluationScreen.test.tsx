import { render, screen, within } from "@testing-library/react";

import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import { useTransactionEvaluation } from "../api/hooks";
import type { RuleEvaluation, TransactionEvaluation } from "../types";
import { TransactionEvaluationScreen } from "./TransactionEvaluationScreen";

jest.mock("../api/hooks", () => ({ useTransactionEvaluation: jest.fn() }));

const RULE_EVALUATION: RuleEvaluation = {
  ruleId: "rule-1",
  ruleName: "R-03 Velká částka",
  ruleType: "deterministic",
  ruleVersionNumber: 1,
  baseScore: 80,
  sensitivity: 100,
  score: 80,
  adjustedScore: 80,
  isFailed: true,
  escalationRole: "contact_person",
  trace: [{ condition: "Částka", isMet: true, detail: "amount_czk (1000) > 500" }],
};

function buildEvaluation(failedRules: RuleEvaluation[]): TransactionEvaluation {
  return {
    batchId: "run-1",
    transaction: {
      transactionId: "TX000000001",
      clientId: "K000001",
      bookedAt: "2026-07-01T10:00:00.000Z",
      amount: 1000,
      currency: "CZK",
      amountCzk: 1000,
      payerCountry: "CZ",
      payeeCountry: "SK",
      payerAccount: "",
      payeeAccount: "",
      transactionType: "incoming payment",
    },
    client: { id: "K000001", riskProfile: "high", isPep: false, country: "CZ" },
    bucket: "alert",
    failedRules,
    passedRules: [],
    skippedRules: [],
  };
}

function renderScreen(failedRules: RuleEvaluation[]) {
  jest.mocked(useTransactionEvaluation).mockReturnValue({
    data: buildEvaluation(failedRules),
    error: null,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useTransactionEvaluation>);
  render(
    <I18nProvider initialLocale="en">
      <TransactionEvaluationScreen batchId="run-1" transactionId="TX000000001" />
    </I18nProvider>,
  );
  return screen.getByRole("article");
}

describe("TransactionEvaluationScreen score calculation", () => {
  it("explains that a matching rule gets its whole base score", () => {
    const ruleCard = renderScreen([RULE_EVALUATION]);

    expect(within(ruleCard).getByText(en.transactionDetail.baseScore)).toBeTruthy();
    expect(within(ruleCard).getByText(en.transactionDetail.baseScoreHint)).toBeTruthy();
    expect(
      within(ruleCard)
        .getByRole("meter", { name: en.transactionDetail.matchedScore })
        .getAttribute("aria-valuenow"),
    ).toBe("80");
    expect(within(ruleCard).queryByText(en.transactionDetail.score)).toBeNull();
  });

  it("keeps the plain score layout when the base score is unknown", () => {
    const ruleCard = renderScreen([{ ...RULE_EVALUATION, ruleType: "agentic", baseScore: 80, score: 64 }]);

    expect(within(ruleCard).queryByText(en.transactionDetail.baseScore)).toBeNull();
    expect(
      within(ruleCard).getByRole("meter", { name: en.transactionDetail.score }).getAttribute("aria-valuenow"),
    ).toBe("64");
  });
});

describe("TransactionEvaluationScreen client transactions", () => {
  it("links a failed rule to the client's transactions with this transaction highlighted", () => {
    const ruleCard = renderScreen([RULE_EVALUATION]);

    const link = within(ruleCard).getByRole("link", { name: en.transactionDetail.showClientTransactions });

    expect(link.getAttribute("href")).toMatch(/^\/transactions\?clientId=K000001&highlight=TX000000001/);
  });
});
