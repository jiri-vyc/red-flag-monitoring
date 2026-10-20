import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { useRolePermissions } from "@/features/users/api/hooks";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";
import fixtureReport from "@/mocks/seed/ruleReviewReport.json";

import { ruleReviewReportDtoSchema } from "../api/dto";
import { useRuleReview, useRuleReviews, useRuleReviewsCapabilities, useStartRuleReview } from "../api/hooks";
import { GapAnalysisScreen } from "./GapAnalysisScreen";

jest.mock("@/providers/ApiModeProvider", () => ({
  useApiMode: () => ({ apiMode: "mock", changeApiMode: jest.fn() }),
}));
jest.mock("@/features/users/api/hooks", () => ({ useRolePermissions: jest.fn() }));
jest.mock("../api/hooks", () => ({
  useRuleReviews: jest.fn(),
  useRuleReview: jest.fn(),
  useStartRuleReview: jest.fn(),
  useRuleReviewsCapabilities: jest.fn(),
}));

const REPORT = ruleReviewReportDtoSchema.parse(fixtureReport);
const SUMMARY = {
  id: REPORT.id,
  status: REPORT.status,
  startedAt: REPORT.startedAt,
  finishedAt: REPORT.finishedAt,
  errorMessage: null,
  createdBy: REPORT.createdBy,
  progress: REPORT.progress,
  evaluationRunId: null,
  findingCounts: { rule_adjustment: 24, new_rule: 0, coverage_gap: 0, association: 38 },
};

function loaded<T>(data: T) {
  return { data, error: null, isPending: false, isError: false, refetch: jest.fn() };
}

function renderScreen(canManageRules: boolean) {
  jest.mocked(useRolePermissions).mockReturnValue({
    canCreateRegulation: false,
    canDraftPolicies: false,
    canApprovePolicy: false,
    canDraftRules: false,
    canManageRules,
  });
  jest.mocked(useRuleReviewsCapabilities).mockReturnValue({ canStartReview: true });
  jest
    .mocked(useRuleReviews)
    .mockReturnValue(loaded([SUMMARY]) as unknown as ReturnType<typeof useRuleReviews>);
  jest.mocked(useRuleReview).mockReturnValue(loaded(REPORT) as unknown as ReturnType<typeof useRuleReview>);
  jest.mocked(useStartRuleReview).mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    data: undefined,
  } as unknown as ReturnType<typeof useStartRuleReview>);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider initialLocale="en">{children}</I18nProvider>
  );
  return render(<GapAnalysisScreen requestedReviewId={null} />, { wrapper });
}

describe("GapAnalysisScreen", () => {
  it("shows the findings of the newest review to the compliance officer", () => {
    renderScreen(true);

    expect(screen.getByRole<HTMLButtonElement>("button", { name: en.ruleReviews.startReview }).disabled).toBe(
      false,
    );
    expect(screen.getByRole("heading", { name: en.ruleReviews.gaps })).toBeTruthy();
    expect(screen.getByRole("heading", { name: en.ruleReviews.recalibrations })).toBeTruthy();
    expect(screen.getByRole("heading", { name: en.ruleReviews.associations })).toBeTruthy();
    expect(screen.getAllByText(en.ruleReviews.notCovered)).toHaveLength(4);
  });

  it("hides the review and its client lists from other roles", () => {
    renderScreen(false);

    expect(screen.queryByRole("button", { name: en.ruleReviews.startReview })).toBeNull();
    expect(screen.queryByRole("heading", { name: en.ruleReviews.gaps })).toBeNull();
    expect(screen.getByText(/Only the Compliance officer role/)).toBeTruthy();
  });
});
