import { render, screen, within } from "@testing-library/react";

import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import { useTransactionEvaluation } from "../api/hooks";
import type { RuleEvaluation, TransactionEvaluation } from "../types";
import { TransactionEvaluationScreen } from "./TransactionEvaluationScreen";

const PATHNAME = "/batches/run-1/transactions/TX000000001";

jest.mock("next/navigation", () => ({ usePathname: () => PATHNAME }));
jest.mock("../api/hooks", () => ({ useTransactionEvaluation: jest.fn() }));
// The FAÚ report action has its own tests (FauReportAlertAction.test.tsx).
jest.mock("@/features/fauReports/components/FauReportAlertAction", () => ({
  FauReportAlertAction: () => null,
}));

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

function buildEvaluation(
  failedRules: RuleEvaluation[],
  passedRules: RuleEvaluation[] = [],
): TransactionEvaluation {
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
    passedRules,
    skippedRules: [],
  };
}

function renderScreen(failedRules: RuleEvaluation[], passedRules: RuleEvaluation[] = []) {
  jest.mocked(useTransactionEvaluation).mockReturnValue({
    data: buildEvaluation(failedRules, passedRules),
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
  return screen.queryByRole("article");
}

function renderRuleCard(failedRules: RuleEvaluation[]): HTMLElement {
  const ruleCard = renderScreen(failedRules);
  if (ruleCard === null) {
    throw new Error("Expected a failed rule card.");
  }
  return ruleCard;
}

describe("TransactionEvaluationScreen score calculation", () => {
  it("explains that a matching rule gets its whole base score", () => {
    const ruleCard = renderRuleCard([RULE_EVALUATION]);

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
    const ruleCard = renderRuleCard([{ ...RULE_EVALUATION, ruleType: "agentic", baseScore: 80, score: 64 }]);

    expect(within(ruleCard).queryByText(en.transactionDetail.baseScore)).toBeNull();
    expect(
      within(ruleCard).getByRole("meter", { name: en.transactionDetail.score }).getAttribute("aria-valuenow"),
    ).toBe("64");
  });
});

describe("TransactionEvaluationScreen client transactions", () => {
  it("links a failed rule to the client's transactions with this transaction highlighted", () => {
    const ruleCard = renderRuleCard([RULE_EVALUATION]);

    const link = within(ruleCard).getByRole("link", { name: en.transactionDetail.showClientTransactions });

    expect(link.getAttribute("href")).toMatch(/^\/transactions\?clientId=K000001&highlight=TX000000001/);
  });
});

describe("TransactionEvaluationScreen rule cards", () => {
  it("names the adjusted score tile for assistive technology", () => {
    const ruleCard = renderRuleCard([RULE_EVALUATION]);

    expect(
      within(ruleCard).getByRole("img", { name: `${en.transactionDetail.adjustedScore}: 80 / 100` }),
    ).toBeTruthy();
  });

  it("renders trace steps that share a condition text", () => {
    const sameCondition = { condition: "Částka", isMet: false, detail: "amount_czk (1000) > 5000" };
    const ruleCard = renderRuleCard([
      { ...RULE_EVALUATION, trace: [...RULE_EVALUATION.trace, sameCondition] },
    ]);

    expect(within(ruleCard).getAllByText("Částka")).toHaveLength(2);
  });
});

describe("TransactionEvaluationScreen passed rules", () => {
  it("puts the rule link in the expanded panel, not in the summary, with a return path", () => {
    const passedRule = { ...RULE_EVALUATION, ruleId: "rule-2", isFailed: false, score: 0, adjustedScore: 0 };
    renderScreen([], [passedRule]);

    const details = screen.getByText(passedRule.ruleName).closest("details");
    if (details === null) {
      throw new Error("Expected the passed rule disclosure.");
    }
    const link = within(details).getByRole("link", { name: en.transactionDetail.openRule, hidden: true });

    expect(link.closest("summary")).toBeNull();
    expect(link.getAttribute("href")).toBe(`/rules/rule-2?from=${encodeURIComponent(PATHNAME)}`);
  });
});
