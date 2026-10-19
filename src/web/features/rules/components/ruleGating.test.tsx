import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { usePolicies } from "@/features/policies/api/hooks";
import type { Policy } from "@/features/policies/types";
import { useRegulations } from "@/features/regulations/api/hooks";
import type { Regulation } from "@/features/regulations/types";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import type { RulesCapabilities } from "../api/contract";
import { useCreateManualRule, useRejectRule, useRulesCapabilities } from "../api/hooks";
import { ManualRuleForm } from "./ManualRuleForm";
import { RejectRulePanel } from "./RejectRulePanel";

// The shared backend database has almost no rules, so rule-level gating is covered here instead of in the browser.
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/features/policies/api/hooks", () => ({ usePolicies: jest.fn() }));
jest.mock("@/features/regulations/api/hooks", () => ({ useRegulations: jest.fn() }));
jest.mock("../api/hooks", () => ({
  useCreateManualRule: jest.fn(),
  useRejectRule: jest.fn(),
  useRulesCapabilities: jest.fn(),
}));

const ALL_CAPABILITIES: RulesCapabilities = {
  canEditDraftContent: true,
  canCreateDeterministicRule: true,
  canCreateAgenticRule: true,
  canSuggestWhitelistClients: true,
};
const LIVE_CAPABILITIES: RulesCapabilities = {
  canEditDraftContent: false,
  canCreateDeterministicRule: false,
  canCreateAgenticRule: true,
  canSuggestWhitelistClients: false,
};

const POLICY: Policy = {
  id: "policy-1",
  name: "Předpis AML",
  legalBases: [{ regulationId: "reg-1", ref: "§ 6" }],
  status: "approved",
  origin: "manual",
  text: "",
  createdAt: "2026-10-19T10:00:00.000Z",
  updatedAt: "2026-10-19T10:00:00.000Z",
  approvedBy: null,
  approvedAt: null,
  ruleIds: [],
};

const REGULATION: Regulation = {
  id: "reg-1",
  name: "Zákon č. 253/2008 Sb.",
  shortName: "AML zákon",
  jurisdiction: "CZ",
  description: "",
  sourceUrl: "",
  version: "",
  lastCheckedAt: "2026-10-19T10:00:00.000Z",
  keyProvisions: [],
  policyIds: ["policy-1"],
  ruleIds: [],
};

const mutate = jest.fn();

function renderInEnglish(children: ReactNode) {
  return render(<I18nProvider initialLocale="en">{children}</I18nProvider>);
}

beforeEach(() => {
  mutate.mockReset();
  jest.mocked(usePolicies).mockReturnValue({
    isPending: false,
    isError: false,
    data: [POLICY],
  } as unknown as ReturnType<typeof usePolicies>);
  jest.mocked(useRegulations).mockReturnValue({
    isPending: false,
    isError: false,
    data: [REGULATION],
  } as unknown as ReturnType<typeof useRegulations>);
  const mutation = { mutate, reset: jest.fn(), isPending: false, error: null };
  jest
    .mocked(useCreateManualRule)
    .mockReturnValue(mutation as unknown as ReturnType<typeof useCreateManualRule>);
  jest.mocked(useRejectRule).mockReturnValue(mutation as unknown as ReturnType<typeof useRejectRule>);
});

describe("ManualRuleForm rule types", () => {
  it("offers both rule types when every capability is available (mock)", () => {
    jest.mocked(useRulesCapabilities).mockReturnValue(ALL_CAPABILITIES);
    renderInEnglish(<ManualRuleForm />);

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText(en.ruleType.deterministic)).toBeTruthy();
  });

  it("offers only agentic, preselected, when the API cannot generate deterministic rules (live)", () => {
    jest.mocked(useRulesCapabilities).mockReturnValue(LIVE_CAPABILITIES);
    renderInEnglish(<ManualRuleForm />);

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(1);
    expect(radios[0]?.checked).toBe(true);
    expect(screen.getByText(en.ruleType.agentic)).toBeTruthy();
    expect(screen.queryByText(en.ruleType.deterministic)).toBeNull();
  });

  it("shows a notice instead of the form when no rule type can be created", () => {
    jest.mocked(useRulesCapabilities).mockReturnValue({ ...LIVE_CAPABILITIES, canCreateAgenticRule: false });
    renderInEnglish(<ManualRuleForm />);

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(en.ruleForm.unavailable)).toBeTruthy();
  });
});

describe("ManualRuleForm source (M4, M5)", () => {
  const fillDescription = () =>
    fireEvent.change(screen.getByLabelText(en.ruleForm.description), {
      target: { value: "Odchozí platba PEP nad 100 000 CZK" },
    });

  beforeEach(() => jest.mocked(useRulesCapabilities).mockReturnValue(LIVE_CAPABILITIES));

  it("requires a legal basis with a regulation and a provision", () => {
    renderInEnglish(<ManualRuleForm />);
    fillDescription();
    fireEvent.click(screen.getByRole("button", { name: en.ruleForm.submit }));

    expect(screen.getByRole("alert").textContent).toBe(en.ruleForm.validationLegalBases);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("creates a rule without a policy, citing the selected regulation provision", () => {
    renderInEnglish(<ManualRuleForm />);
    fillDescription();
    fireEvent.change(screen.getByLabelText(en.ruleForm.regulation), { target: { value: "reg-1" } });
    fireEvent.change(screen.getByLabelText(en.ruleForm.provisionRef), { target: { value: " § 9a " } });
    fireEvent.click(screen.getByRole("button", { name: en.ruleForm.submit }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ policyId: null, legalBases: [{ regulationId: "reg-1", ref: "§ 9a" }] }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("passes the selected policy when one is chosen", () => {
    renderInEnglish(<ManualRuleForm />);
    fillDescription();
    fireEvent.change(screen.getByLabelText(en.ruleForm.policy), { target: { value: "policy-1" } });
    fireEvent.change(screen.getByLabelText(en.ruleForm.regulation), { target: { value: "reg-1" } });
    fireEvent.change(screen.getByLabelText(en.ruleForm.provisionRef), { target: { value: "§ 9a" } });
    fireEvent.click(screen.getByRole("button", { name: en.ruleForm.submit }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ policyId: "policy-1" }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});

describe("RejectRulePanel", () => {
  const renderPanel = () =>
    renderInEnglish(<RejectRulePanel ruleId="rule-1" onRejected={jest.fn()} onCancel={jest.fn()} />);

  it("requires a reason before rejecting", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(en.rules.rejectComment), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: en.rules.confirmReject }));

    expect(screen.getByRole("alert").textContent).toBe(en.rules.rejectCommentRequired);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason to the reject mutation", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(en.rules.rejectComment), {
      target: { value: "  Práh neodpovídá předpisu  " },
    });
    fireEvent.click(screen.getByRole("button", { name: en.rules.confirmReject }));

    expect(mutate).toHaveBeenCalledWith(
      { ruleId: "rule-1", comment: "Práh neodpovídá předpisu" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
