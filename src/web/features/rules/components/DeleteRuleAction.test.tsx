import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { useRolePermissions } from "@/features/users/api/hooks";
import { getRolePermissions } from "@/features/users/permissions";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import { useDeleteRule, useRulesCapabilities } from "../api/hooks";
import type { RulesCapabilities } from "../api/contract";
import type { Rule, RuleVersion } from "../types";
import { DeleteRuleAction } from "./DeleteRuleAction";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/features/users/api/hooks", () => ({ useRolePermissions: jest.fn() }));
jest.mock("../api/hooks", () => ({ useDeleteRule: jest.fn(), useRulesCapabilities: jest.fn() }));

const NOW = "2026-10-19T10:00:00.000Z";
const CAPABILITIES: RulesCapabilities = {
  canEditDraftContent: true,
  canCreateDeterministicRule: true,
  canCreateAgenticRule: true,
  canSuggestWhitelistClients: true,
  canDeleteRule: true,
};

function createRule(versionState: RuleVersion["state"]): Rule {
  const isApproved = versionState === "approved";
  return {
    id: "rule-1",
    name: "Test rule",
    description: "",
    type: "agentic",
    status: isApproved ? "active" : "pending_for_review",
    origin: "manual",
    policyId: null,
    runningVersionNumber: isApproved ? 1 : null,
    versions: [
      {
        versionNumber: 1,
        state: versionState,
        content: { type: "agentic", ruleText: "v1" },
        config: { sensitivity: 80, riskProfiles: ["high"], escalationRole: "contact_person" },
        baseScore: null,
        changeNote: "",
        createdAt: NOW,
        createdBy: "Author",
        reviewedBy: null,
        reviewedAt: null,
        legalBases: [],
      },
    ],
    whitelistAllowed: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const mutate = jest.fn();

function renderInEnglish(children: ReactNode) {
  return render(<I18nProvider initialLocale="en">{children}</I18nProvider>);
}

const deleteButton = () => screen.getByRole("button", { name: en.rules.deleteRule }) as HTMLButtonElement;

beforeEach(() => {
  mutate.mockReset();
  push.mockReset();
  jest.mocked(useRulesCapabilities).mockReturnValue(CAPABILITIES);
  jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("compliance_officer"));
  jest
    .mocked(useDeleteRule)
    .mockReturnValue({ mutate, isPending: false, error: null } as unknown as ReturnType<
      typeof useDeleteRule
    >);
});

describe("DeleteRuleAction", () => {
  it("deletes a never-approved rule after confirmation and returns to the rule list", () => {
    mutate.mockImplementation((_ruleId: string, options: { onSuccess: () => void }) => options.onSuccess());
    renderInEnglish(<DeleteRuleAction rule={createRule("pending_review")} />);

    fireEvent.click(deleteButton());
    expect(screen.getByText(en.rules.deleteWarning)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));

    expect(mutate).toHaveBeenCalledWith(
      "rule-1",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(push).toHaveBeenCalledWith("/rules");
  });

  it("closes the confirmation on cancel without deleting", () => {
    renderInEnglish(<DeleteRuleAction rule={createRule("draft")} />);

    fireEvent.click(deleteButton());
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));

    expect(screen.queryByText(en.rules.deleteWarning)).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("disables the button with the reason for a rule that was approved", () => {
    renderInEnglish(<DeleteRuleAction rule={createRule("approved")} />);

    const reason = screen.getByText(en.rules.deleteNotAllowed);
    expect(deleteButton().disabled).toBe(true);
    expect(deleteButton().getAttribute("aria-describedby")).toBe(reason.id);
  });

  it("disables the button naming the role for a role that cannot manage rules", () => {
    jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("compliance_analyst"));
    renderInEnglish(<DeleteRuleAction rule={createRule("draft")} />);

    expect(deleteButton().disabled).toBe(true);
    expect(screen.getByText("Requires the Compliance officer role")).toBeTruthy();
  });

  it("renders nothing when the API cannot delete rules (live)", () => {
    jest.mocked(useRulesCapabilities).mockReturnValue({ ...CAPABILITIES, canDeleteRule: false });
    const { container } = renderInEnglish(<DeleteRuleAction rule={createRule("draft")} />);

    expect(container.textContent).toBe("");
  });
});
