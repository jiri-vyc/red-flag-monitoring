import { fireEvent, render, screen } from "@testing-library/react";

import type { Policy } from "@/features/policies/types";
import type { Regulation } from "@/features/regulations/types";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import type { PolicyDraftResult } from "../types";
import { PolicyDraftStep } from "./PolicyDraftStep";

jest.mock("@/features/users/api/hooks", () => ({ useRolePermissions: () => ({ canApprovePolicy: true }) }));

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

function renderStep(approvedPolicyIds: string[] = []) {
  const onApprove = jest.fn();
  render(
    <I18nProvider initialLocale="en">
      <PolicyDraftStep
        draft={DRAFT}
        initialSelection={{ policyTexts: {}, skippedPolicyIds: [] }}
        approvedPolicyIds={approvedPolicyIds}
        onApprove={onApprove}
      />
    </I18nProvider>,
  );
  return onApprove;
}

const approveButton = () => screen.getByRole<HTMLButtonElement>("button", { name: en.wizard.generateRules });

describe("PolicyDraftStep", () => {
  it("selects every draft by default and passes the skipped ones and edited texts on approval", () => {
    const onApprove = renderStep();
    const checkboxes = screen.getAllByRole<HTMLInputElement>("checkbox");
    expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([true, true]);
    expect(screen.getByText(en.wizard.skipPolicyHint)).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: /Předpis b/ }));
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Upravený text A" } });
    fireEvent.click(approveButton());

    expect(onApprove).toHaveBeenCalledWith({
      policyTexts: { a: "Upravený text A", b: "Text B" },
      skippedPolicyIds: ["b"],
    });
  });

  it("disables approval when every draft is skipped and nothing is approved yet", () => {
    renderStep();

    for (const checkbox of screen.getAllByRole("checkbox")) {
      fireEvent.click(checkbox);
    }

    expect(approveButton().disabled).toBe(true);
    expect(screen.getByText(en.wizard.noPolicySelected)).toBeTruthy();
  });

  it("shows approved policies read-only and continues with them when the rest is skipped", () => {
    const onApprove = renderStep(["a"]);

    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByText("Text A").tagName).toBe("STRONG");

    fireEvent.click(screen.getByRole("checkbox"));

    expect(approveButton().disabled).toBe(false);
    fireEvent.click(approveButton());
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ skippedPolicyIds: ["b"] }));
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
