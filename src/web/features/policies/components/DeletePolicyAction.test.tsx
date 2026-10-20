import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { useRolePermissions } from "@/features/users/api/hooks";
import { getRolePermissions } from "@/features/users/permissions";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import { useDeletePolicy, usePoliciesCapabilities } from "../api/hooks";
import type { Policy, PolicyVersionState } from "../types";
import { DeletePolicyAction } from "./DeletePolicyAction";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/features/users/api/hooks", () => ({ useRolePermissions: jest.fn() }));
jest.mock("../api/hooks", () => ({ useDeletePolicy: jest.fn(), usePoliciesCapabilities: jest.fn() }));

const NOW = "2026-10-19T10:00:00.000Z";

function createPolicy({ state, ruleIds = [] }: { state: PolicyVersionState; ruleIds?: string[] }): Policy {
  return {
    id: "policy-1",
    name: "Předpis AML",
    legalBases: [],
    status: state === "approved" ? "approved" : "draft",
    origin: "manual",
    text: "",
    createdAt: NOW,
    updatedAt: NOW,
    approvedBy: null,
    approvedAt: null,
    ruleIds,
    versions: [
      {
        versionNumber: 1,
        state,
        createdVia: "manual",
        text: "",
        legalBases: [],
        createdBy: "Author",
        createdAt: NOW,
        reviewedBy: null,
        reviewedAt: null,
        reviewComment: null,
      },
    ],
  };
}

const mutate = jest.fn();

function renderInEnglish(children: ReactNode) {
  return render(<I18nProvider initialLocale="en">{children}</I18nProvider>);
}

const deleteButton = () =>
  screen.getByRole("button", { name: en.policies.deletePolicy }) as HTMLButtonElement;

beforeEach(() => {
  mutate.mockReset();
  push.mockReset();
  jest.mocked(usePoliciesCapabilities).mockReturnValue({ canDeletePolicy: true });
  jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("compliance_analyst"));
  jest
    .mocked(useDeletePolicy)
    .mockReturnValue({ mutate, isPending: false, error: null } as unknown as ReturnType<
      typeof useDeletePolicy
    >);
});

describe("DeletePolicyAction", () => {
  it("deletes a draft policy after confirmation and returns to the policy list", () => {
    mutate.mockImplementation((_policyId: string, options: { onSuccess: () => void }) => options.onSuccess());
    renderInEnglish(<DeletePolicyAction policy={createPolicy({ state: "draft" })} />);

    fireEvent.click(deleteButton());
    expect(screen.getByText(en.policies.deleteWarning)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));

    expect(mutate).toHaveBeenCalledWith(
      "policy-1",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(push).toHaveBeenCalledWith("/policies");
  });

  it("disables the button with the reason for an approved policy", () => {
    renderInEnglish(<DeletePolicyAction policy={createPolicy({ state: "approved" })} />);

    const reason = screen.getByText(en.policies.deleteBlockedApproved);
    expect(deleteButton().disabled).toBe(true);
    expect(deleteButton().getAttribute("aria-describedby")).toBe(reason.id);
  });

  it("disables the button with the reason for a policy rules derive from", () => {
    renderInEnglish(<DeletePolicyAction policy={createPolicy({ state: "draft", ruleIds: ["rule-1"] })} />);

    expect(screen.getByText(en.policies.deleteBlockedByRules)).toBeTruthy();
    expect(deleteButton().disabled).toBe(true);
  });

  it("disables the button naming the role for a role that cannot draft policies", () => {
    jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("compliance_officer"));
    renderInEnglish(<DeletePolicyAction policy={createPolicy({ state: "draft" })} />);

    expect(deleteButton().disabled).toBe(true);
    expect(screen.getByText(`Requires the ${en.roles.compliance_analyst} role`)).toBeTruthy();
  });

  it("renders nothing when the API cannot delete policies (live)", () => {
    jest.mocked(usePoliciesCapabilities).mockReturnValue({ canDeletePolicy: false });
    const { container } = renderInEnglish(<DeletePolicyAction policy={createPolicy({ state: "draft" })} />);

    expect(container.textContent).toBe("");
  });
});
