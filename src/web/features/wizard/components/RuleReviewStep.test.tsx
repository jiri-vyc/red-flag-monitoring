import { render, screen } from "@testing-library/react";

import { useDraftingJobGroup } from "@/features/draftingJobs/api/hooks";
import { useRulesCapabilities, useRuleTransition, useUpdateDraftContent } from "@/features/rules/api/hooks";
import type { Rule } from "@/features/rules/types";
import { useRolePermissions } from "@/features/users/api/hooks";
import { getRolePermissions } from "@/features/users/permissions";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import { RuleReviewStep } from "./RuleReviewStep";

jest.mock("@/features/draftingJobs/api/hooks", () => ({ useDraftingJobGroup: jest.fn() }));
jest.mock("@/features/users/api/hooks", () => ({ useRolePermissions: jest.fn() }));
jest.mock("@/features/rules/api/hooks", () => ({
  useRejectRule: jest.fn(),
  useRulesCapabilities: jest.fn(),
  useRuleTransition: jest.fn(),
  useUpdateDraftContent: jest.fn(),
}));

const NOW = "2026-10-19T10:00:00.000Z";

const DRAFT_RULE: Rule = {
  id: "rule/1",
  name: "Odchozí platba PEP",
  description: "",
  type: "agentic",
  status: "draft",
  origin: "wizard",
  policyId: "policy-1",
  runningVersionNumber: null,
  versions: [
    {
      versionNumber: 1,
      state: "draft",
      content: { type: "agentic", ruleText: "v1" },
      config: { sensitivity: 80, riskProfiles: ["high"], escalationRole: "contact_person" },
      baseScore: null,
      changeNote: "",
      createdAt: NOW,
      createdBy: "AI",
      reviewedBy: null,
      reviewedAt: null,
      legalBases: [],
    },
  ],
  whitelistAllowed: true,
  createdAt: NOW,
  updatedAt: NOW,
};

beforeEach(() => {
  jest
    .mocked(useDraftingJobGroup)
    .mockReturnValue({ jobs: [] } as unknown as ReturnType<typeof useDraftingJobGroup>);
  jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("compliance_officer"));
  jest.mocked(useRulesCapabilities).mockReturnValue({
    canEditDraftContent: true,
    canCreateDeterministicRule: true,
    canCreateAgenticRule: true,
    canSuggestWhitelistClients: true,
    canDeleteRule: true,
  });
  const idleMutation = { mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null };
  jest
    .mocked(useRuleTransition)
    .mockReturnValue(idleMutation as unknown as ReturnType<typeof useRuleTransition>);
  jest
    .mocked(useUpdateDraftContent)
    .mockReturnValue(idleMutation as unknown as ReturnType<typeof useUpdateDraftContent>);
});

describe("RuleReviewStep", () => {
  it("links each drafted rule to its detail in a new tab, keeping the wizard open", () => {
    render(
      <I18nProvider initialLocale="en">
        <RuleReviewStep
          rules={[DRAFT_RULE]}
          rulesJobIds={[]}
          isFinishing={false}
          onRuleChange={jest.fn()}
          onFinish={jest.fn()}
        />
      </I18nProvider>,
    );

    const detailLink = screen.getByRole("link", { name: en.rules.openDetailInNewTab });
    expect(detailLink.getAttribute("href")).toBe("/rules/rule%2F1");
    expect(detailLink.getAttribute("target")).toBe("_blank");
    expect(detailLink.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
