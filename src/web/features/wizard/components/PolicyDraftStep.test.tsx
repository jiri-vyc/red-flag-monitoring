import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { Policy, PolicyVersion } from "@/features/policies/types";
import type { Regulation } from "@/features/regulations/types";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import type { PolicyDraftResult } from "../types";
import { PolicyDraftStep } from "./PolicyDraftStep";

jest.mock("@/features/users/api/hooks", () => ({ useRolePermissions: () => ({ canApprovePolicy: true }) }));
const rejectMutateAsync = jest.fn();
jest.mock("@/features/policies/api/hooks", () => ({
  useRejectPolicy: () => ({ mutateAsync: rejectMutateAsync, isPending: false, error: null }),
}));

function createPolicy(id: string, text: string): Policy {
  return {
    id,
    name: `Předpis ${id}`,
    legalBases: [],
    status: "draft",
    origin: "generated",
    text,
    createdAt: "",
    updatedAt: "",
    approvedBy: null,
    approvedAt: null,
    ruleIds: [],
    versions: [],
  };
}

const DRAFT: PolicyDraftResult = {
  regulation: { id: "regulation-1", shortName: "AMLZ" } as Regulation,
  policies: [createPolicy("a", "**Text A**"), createPolicy("b", "Text B")],
};

function rejectPolicy(policy: Policy, reason: string): Policy {
  const rejectedVersion: PolicyVersion = {
    versionNumber: 1,
    state: "rejected",
    createdVia: "wizard",
    text: policy.text,
    legalBases: [],
    createdBy: "AI",
    createdAt: "",
    reviewedBy: "Petr Svoboda",
    reviewedAt: "",
    reviewComment: reason,
  };
  return { ...policy, versions: [rejectedVersion] };
}

function renderStep(approvedPolicyIds: string[] = [], draft: PolicyDraftResult = DRAFT) {
  const onApprove = jest.fn();
  const onPolicyRejected = jest.fn();
  render(
    <I18nProvider initialLocale="en">
      <PolicyDraftStep
        draft={draft}
        initialSelection={{ policyTexts: {}, skippedPolicyIds: [] }}
        approvedPolicyIds={approvedPolicyIds}
        onApprove={onApprove}
        onPolicyRejected={onPolicyRejected}
      />
    </I18nProvider>,
  );
  return Object.assign(onApprove, { onPolicyRejected });
}

const includeToggles = () =>
  screen.getAllByRole<HTMLButtonElement>("button", { name: new RegExp(`^${en.wizard.includePolicy}`) });
const includeToggle = (policyName: string) =>
  screen.getByRole<HTMLButtonElement>("button", {
    name: new RegExp(`^${en.wizard.includePolicy}.*${policyName}$`),
  });
const isPressed = (button: HTMLButtonElement) => button.getAttribute("aria-pressed") === "true";

const approveButton = () => screen.getByRole<HTMLButtonElement>("button", { name: en.wizard.generateRules });

describe("PolicyDraftStep", () => {
  it("selects every draft by default and passes the skipped ones and edited texts on approval", () => {
    const onApprove = renderStep();
    expect(includeToggles().map(isPressed)).toEqual([true, true]);
    expect(screen.getByText(en.wizard.skipPolicyHint)).toBeTruthy();

    fireEvent.click(includeToggle("Předpis b"));
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Upravený text A" } });
    fireEvent.click(approveButton());

    expect(onApprove).toHaveBeenCalledWith({
      policyTexts: { a: "Upravený text A", b: "Text B" },
      skippedPolicyIds: ["b"],
    });
  });

  it("toggles a draft's selection with aria-pressed and leaves a deselected draft out of the approval", () => {
    const onApprove = renderStep();

    fireEvent.click(includeToggle("Předpis a"));
    expect(isPressed(includeToggle("Předpis a"))).toBe(false);
    expect(isPressed(includeToggle("Předpis b"))).toBe(true);
    fireEvent.click(approveButton());
    expect(onApprove).toHaveBeenLastCalledWith(expect.objectContaining({ skippedPolicyIds: ["a"] }));

    fireEvent.click(includeToggle("Předpis a"));
    expect(isPressed(includeToggle("Předpis a"))).toBe(true);
    fireEvent.click(approveButton());
    expect(onApprove).toHaveBeenLastCalledWith(expect.objectContaining({ skippedPolicyIds: [] }));
  });

  it("disables approval when every draft is skipped and nothing is approved yet", () => {
    renderStep();

    for (const toggle of includeToggles()) {
      fireEvent.click(toggle);
    }

    expect(approveButton().disabled).toBe(true);
    expect(screen.getByText(en.wizard.noPolicySelected)).toBeTruthy();
  });

  it("shows approved policies read-only and continues with them when the rest is skipped", () => {
    const onApprove = renderStep(["a"]);

    expect(includeToggles()).toHaveLength(1);
    expect(screen.getByText("Text A").tagName).toBe("STRONG");

    fireEvent.click(includeToggle("Předpis b"));

    expect(approveButton().disabled).toBe(false);
    fireEvent.click(approveButton());
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ skippedPolicyIds: ["b"] }));
  });

  it("rejects a draft with a required reason and reports the rejected policy", async () => {
    const rejectedB = rejectPolicy(DRAFT.policies[1]!, "Chybí práh");
    rejectMutateAsync.mockResolvedValue(rejectedB);
    const { onPolicyRejected } = renderStep();

    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^${en.wizard.rejectPolicy}.*Předpis b$`) }),
    );
    fireEvent.click(screen.getByRole("button", { name: en.policies.confirmReject }));

    expect(screen.getByText(en.policies.rejectReasonRequired)).toBeTruthy();
    expect(rejectMutateAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(en.policies.rejectReason), { target: { value: " Chybí práh " } });
    fireEvent.click(screen.getByRole("button", { name: en.policies.confirmReject }));

    expect(rejectMutateAsync).toHaveBeenCalledWith({ policyId: "b", reason: "Chybí práh" });
    await waitFor(() => expect(onPolicyRejected).toHaveBeenCalledWith(rejectedB));
  });

  it("shows a rejected draft read-only with its reason and continues with the rest", () => {
    const onApprove = renderStep([], {
      ...DRAFT,
      policies: [DRAFT.policies[0]!, rejectPolicy(DRAFT.policies[1]!, "Chybí práh")],
    });

    expect(screen.getByText(en.policies.rejected)).toBeTruthy();
    expect(screen.getByText("Chybí práh")).toBeTruthy();
    expect(includeToggles()).toHaveLength(1);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByText(en.wizard.skipPolicyHint)).toBeTruthy();

    fireEvent.click(approveButton());
    expect(onApprove).toHaveBeenCalled();
  });

  it("offers no rules step when every draft is rejected", () => {
    renderStep([], { ...DRAFT, policies: DRAFT.policies.map((policy) => rejectPolicy(policy, "Nevhodné")) });

    expect(screen.getByText(en.wizard.allPoliciesRejectedTitle)).toBeTruthy();
    expect(screen.queryByRole("button", { name: en.wizard.generateRules })).toBeNull();
    expect(screen.getByRole("link", { name: en.wizard.goToPolicies }).getAttribute("href")).toBe("/policies");
    expect(screen.getByRole("link", { name: en.wizard.startAgain }).getAttribute("href")).toBe("/wizard");
  });

  it("previews the edited text formatted and keeps the edit when switching back", () => {
    renderStep();
    const [textA] = screen.getAllByRole("textbox");
    fireEvent.change(textA, { target: { value: "# Nadpis\n\n- bod" } });

    fireEvent.click(screen.getAllByRole("radio", { name: en.policies.preview })[0]);

    expect(screen.getByRole("heading", { name: "Nadpis" })).toBeTruthy();
    expect(screen.getByText("bod").tagName).toBe("LI");

    fireEvent.click(screen.getAllByRole("radio", { name: en.common.edit })[0]);

    expect(screen.getAllByRole<HTMLTextAreaElement>("textbox")[0].value).toBe("# Nadpis\n\n- bod");
  });
});
