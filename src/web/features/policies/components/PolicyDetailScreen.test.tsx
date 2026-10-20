import { fireEvent, render, screen } from "@testing-library/react";

import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import { usePolicy } from "../api/hooks";
import type { Policy, PolicyVersion } from "../types";
import { PolicyDetailScreen } from "./PolicyDetailScreen";

// The real editor is rendered, so unsaved draft edits are covered; its mutations stay idle.
jest.mock("../api/hooks", () => {
  const idleMutation = {
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  };
  return {
    usePolicy: jest.fn(),
    useUpdatePolicyText: () => idleMutation,
    useApprovePolicy: () => idleMutation,
    usePoliciesCapabilities: () => ({ canDeletePolicy: false }),
    useDeletePolicy: () => idleMutation,
  };
});
jest.mock("@/features/rules/api/hooks", () => ({
  useRules: () => ({ data: [], error: null, isPending: false, isError: false, refetch: jest.fn() }),
}));
jest.mock("@/features/regulations/api/hooks", () => ({
  useRegulations: () => ({ data: [], error: null, isPending: false, isError: false, refetch: jest.fn() }),
  useRegulationNames: () => ({ data: {} }),
}));
jest.mock("@/features/users/api/hooks", () => ({ useRolePermissions: () => ({ canApprovePolicy: true }) }));
jest.mock("@/features/draftingJobs/api/hooks", () => ({}));

const REJECTED_VERSION: PolicyVersion = {
  versionNumber: 1,
  state: "rejected",
  createdVia: "wizard",
  text: "Původní text předpisu",
  legalBases: [],
  createdBy: "Jana Nováková",
  createdAt: "2026-10-18T10:00:00.000Z",
  reviewedBy: "Petr Svoboda",
  reviewedAt: "2026-10-18T12:00:00.000Z",
  reviewComment: "Chybí částkový práh",
};

const DRAFT_VERSION: PolicyVersion = {
  ...REJECTED_VERSION,
  versionNumber: 2,
  state: "draft",
  createdVia: "manual",
  text: "Upravený text předpisu",
  createdBy: "Eva Dvořáková",
  reviewedBy: null,
  reviewedAt: null,
  reviewComment: null,
};

const POLICY: Policy = {
  id: "policy-1",
  name: "Předpis AML",
  legalBases: [],
  status: "draft",
  origin: "generated",
  text: DRAFT_VERSION.text,
  createdAt: REJECTED_VERSION.createdAt,
  updatedAt: DRAFT_VERSION.createdAt,
  approvedBy: null,
  approvedAt: null,
  ruleIds: [],
  versions: [REJECTED_VERSION, DRAFT_VERSION],
};

function renderScreen(firstVersion: PolicyVersion = REJECTED_VERSION) {
  jest.mocked(usePolicy).mockReturnValue({
    data: { ...POLICY, versions: [firstVersion, DRAFT_VERSION] },
    error: null,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof usePolicy>);
  render(
    <I18nProvider initialLocale="en">
      <PolicyDetailScreen policyId="policy-1" />
    </I18nProvider>,
  );
}

describe("PolicyDetailScreen version history (issue #5)", () => {
  it("lists versions newest first with author, reviewer and review comment", () => {
    renderScreen();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => row.querySelector("strong")?.textContent)).toEqual(["v2", "v1"]);
    expect(screen.getByText(en.versionState.rejected)).toBeTruthy();
    expect(screen.getByText(en.versionOrigin.wizard)).toBeTruthy();
    expect(screen.getByText("Petr Svoboda")).toBeTruthy();
    expect(screen.getByText("Chybí částkový práh")).toBeTruthy();
    expect(screen.getByText(en.policies.notReviewed)).toBeTruthy();
  });

  it("shows the editable latest version by default and an older version's text when it is selected", () => {
    renderScreen();

    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("Upravený text předpisu");
    expect(screen.getByRole("button", { name: en.policies.viewing }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: en.common.open }));

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Původní text předpisu")).toBeTruthy();
    expect(screen.getByText(/The current one is version 2/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: en.common.open }));

    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("keeps unsaved draft edits while an older version is viewed", () => {
    renderScreen();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Neuložená úprava" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.open }));
    expect(screen.getByText("Původní text předpisu")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.common.open }));

    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("Neuložená úprava");
  });

  it("shows the approved version as current when a newer version was rejected (BE-11)", () => {
    const approvedVersion: PolicyVersion = { ...REJECTED_VERSION, state: "approved", reviewComment: null };
    const rejectedVersion: PolicyVersion = { ...DRAFT_VERSION, state: "rejected", reviewComment: "Ne" };
    jest.mocked(usePolicy).mockReturnValue({
      data: {
        ...POLICY,
        status: "approved",
        text: approvedVersion.text,
        versions: [approvedVersion, rejectedVersion],
      },
      error: null,
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePolicy>);
    render(
      <I18nProvider initialLocale="en">
        <PolicyDetailScreen policyId="policy-1" />
      </I18nProvider>,
    );

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(`${en.policies.text} (v1)`)).toBeTruthy();
    expect(screen.getByText("Původní text předpisu")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: en.common.open }));

    expect(screen.getByText("Upravený text předpisu")).toBeTruthy();
    expect(screen.getByText(/The current one is version 1/)).toBeTruthy();
  });

  it("shows the reviewer even when the review time is missing", () => {
    renderScreen({ ...REJECTED_VERSION, reviewedAt: null });

    expect(screen.getByText("Petr Svoboda")).toBeTruthy();
  });
});
