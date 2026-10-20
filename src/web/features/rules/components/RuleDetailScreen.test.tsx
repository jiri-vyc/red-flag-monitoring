import { fireEvent, render, screen, within } from "@testing-library/react";

import { useRolePermissions } from "@/features/users/api/hooks";
import { getRolePermissions } from "@/features/users/permissions";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import type { RulesCapabilities } from "../api/contract";
import {
  useCreateRuleVersion,
  useDeleteRule,
  useRejectRule,
  useRule,
  useRulesCapabilities,
  useRuleTransition,
  useUpdateDraftContent,
} from "../api/hooks";
import type { Rule } from "../types";
import { RuleDetailScreen } from "./RuleDetailScreen";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/features/users/api/hooks", () => ({ useRolePermissions: jest.fn() }));
// The whitelist and legal bases load their own data and are not part of the actions under test.
jest.mock("./RuleWhitelistCard", () => ({ RuleWhitelistCard: () => null }));
jest.mock("@/features/regulations/components/LegalBasisList", () => ({ LegalBasisList: () => null }));
jest.mock("../api/hooks", () => ({
  useCreateRuleVersion: jest.fn(),
  useDeleteRule: jest.fn(),
  useRejectRule: jest.fn(),
  useRule: jest.fn(),
  useRulesCapabilities: jest.fn(),
  useRuleTransition: jest.fn(),
  useUpdateDraftContent: jest.fn(),
}));

const NOW = "2026-10-19T10:00:00.000Z";
const CAPABILITIES: RulesCapabilities = {
  canEditDraftContent: true,
  canCreateDeterministicRule: true,
  canCreateAgenticRule: true,
  canSuggestWhitelistClients: true,
  canDeleteRule: true,
};

function createRule(status: Rule["status"]): Rule {
  const isApproved = status === "active";
  return {
    id: "rule-1",
    name: "Test rule",
    description: "",
    type: "agentic",
    status,
    origin: "manual",
    policyId: null,
    runningVersionNumber: isApproved ? 1 : null,
    versions: [
      {
        versionNumber: 1,
        state: isApproved ? "approved" : "pending_review",
        content: { type: "agentic", ruleText: "v1" },
        config: { sensitivity: 80, riskProfiles: ["high"], escalationRole: "designated_person" },
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

const transitionMutate = jest.fn();
const rejectMutate = jest.fn();
const updateDraftMutate = jest.fn();

function serveRule(rule: Rule) {
  jest
    .mocked(useRule)
    .mockReturnValue({ isPending: false, isError: false, data: rule } as unknown as ReturnType<
      typeof useRule
    >);
}

// A new element each time, so a rerender reads the rule served by then.
const ruleScreen = () => (
  <I18nProvider initialLocale="en">
    <RuleDetailScreen ruleId="rule-1" returnPath={null} />
  </I18nProvider>
);

function renderRule(rule: Rule) {
  serveRule(rule);
  return render(ruleScreen());
}

/** An active rule whose approved v1 has a pending update v2 with another escalation role. */
function createUpdatedRule(): Rule {
  const rule = createRule("active");
  const [approvedVersion] = rule.versions;
  return {
    ...rule,
    status: "update_for_review",
    versions: [
      approvedVersion!,
      {
        ...approvedVersion!,
        versionNumber: 2,
        state: "pending_review",
        config: { ...approvedVersion!.config, escalationRole: "compliance_officer" },
      },
    ],
  };
}

// A card is the section around its title.
function queryCard(title: string): HTMLElement | null {
  return screen.queryByRole("heading", { level: 2, name: title })?.closest("section") ?? null;
}
function getCard(title: string): HTMLElement {
  const card = queryCard(title);
  if (card === null) {
    throw new Error(`No card titled "${title}".`);
  }
  return card;
}
const actionsCard = () => within(getCard(en.rules.actions));
const reviewCard = () => within(getCard(en.rules.reviewActions));
const changeGroup = () => within(screen.getByRole("group", { name: en.rules.changeActions }));

beforeEach(() => {
  transitionMutate.mockReset();
  rejectMutate.mockReset();
  updateDraftMutate.mockReset();
  jest.mocked(useRulesCapabilities).mockReturnValue(CAPABILITIES);
  jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("compliance_officer"));
  const idleMutation = {
    mutate: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  };
  jest
    .mocked(useRuleTransition)
    .mockReturnValue({ ...idleMutation, mutate: transitionMutate } as unknown as ReturnType<
      typeof useRuleTransition
    >);
  jest
    .mocked(useRejectRule)
    .mockReturnValue({ ...idleMutation, mutate: rejectMutate } as unknown as ReturnType<
      typeof useRejectRule
    >);
  jest.mocked(useDeleteRule).mockReturnValue(idleMutation as unknown as ReturnType<typeof useDeleteRule>);
  jest
    .mocked(useCreateRuleVersion)
    .mockReturnValue(idleMutation as unknown as ReturnType<typeof useCreateRuleVersion>);
  jest
    .mocked(useUpdateDraftContent)
    .mockReturnValue({ ...idleMutation, mutate: updateDraftMutate } as unknown as ReturnType<
      typeof useUpdateDraftContent
    >);
});

function withoutDraftEditing() {
  jest.mocked(useRulesCapabilities).mockReturnValue({ ...CAPABILITIES, canEditDraftContent: false });
}

describe("RuleDetailScreen actions", () => {
  it("offers no escalation role at review when drafts are editable", () => {
    renderRule(createRule("pending_for_review"));

    expect(screen.queryByLabelText(en.rules.escalationRole)).toBeNull();
  });

  it("approves without an escalation role when drafts are editable, so the version keeps its own", () => {
    renderRule(createRule("pending_for_review"));
    fireEvent.click(reviewCard().getByRole("button", { name: en.rules.action.approve }));

    expect(transitionMutate).toHaveBeenCalledWith({
      ruleId: "rule-1",
      action: "approve",
      escalationRole: null,
    });
  });

  it("offers the escalation role at review while drafts can't be edited (until issue #8)", () => {
    withoutDraftEditing();
    renderRule(createRule("draft"));

    const select = actionsCard().getByLabelText<HTMLSelectElement>(en.rules.escalationRole);
    expect(select.value).toBe("designated_person");
  });

  it("approves with the role picked at review while drafts can't be edited", () => {
    withoutDraftEditing();
    renderRule(createRule("pending_for_review"));
    fireEvent.change(actionsCard().getByLabelText(en.rules.escalationRole), {
      target: { value: "contact_person" },
    });
    fireEvent.click(reviewCard().getByRole("button", { name: en.rules.action.approve }));

    expect(transitionMutate).toHaveBeenCalledWith({
      ruleId: "rule-1",
      action: "approve",
      escalationRole: "contact_person",
    });
  });

  it("rejects with the role picked at review while drafts can't be edited", () => {
    withoutDraftEditing();
    renderRule(createRule("pending_for_review"));
    fireEvent.change(actionsCard().getByLabelText(en.rules.escalationRole), {
      target: { value: "contact_person" },
    });
    fireEvent.click(reviewCard().getByRole("button", { name: en.rules.action.reject }));
    const rejectPanel = within(reviewCard().getByRole("form", { name: en.rules.rejectTitle }));
    fireEvent.change(rejectPanel.getByLabelText(en.rules.rejectComment), {
      target: { value: "Špatný práh" },
    });
    fireEvent.click(rejectPanel.getByRole("button", { name: en.rules.confirmReject }));

    expect(rejectMutate).toHaveBeenCalledWith(
      { ruleId: "rule-1", comment: "Špatný práh", escalationRole: "contact_person" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("prefills the draft editor with the draft's config and saves it with the content", () => {
    renderRule(createRule("draft"));
    fireEvent.click(changeGroup().getByRole("button", { name: en.rules.editDraft }));

    // Drafts are editable here, so the only escalation role select is the editor's.
    const select = screen.getByLabelText<HTMLSelectElement>(en.rules.escalationRole);
    expect(select.value).toBe("designated_person");
    expect(screen.getByLabelText<HTMLInputElement>(`${en.ruleForm.sensitivity}: 80`).value).toBe("80");
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: en.riskProfile.high }).checked).toBe(true);

    fireEvent.change(select, { target: { value: "contact_person" } });
    fireEvent.click(screen.getByRole("checkbox", { name: en.riskProfile.medium }));
    fireEvent.click(screen.getByRole("button", { name: en.rules.saveDraft }));

    expect(updateDraftMutate).toHaveBeenCalledWith(
      {
        ruleId: "rule-1",
        content: { type: "agentic", ruleText: "v1" },
        config: { sensitivity: 80, riskProfiles: ["high", "medium"], escalationRole: "contact_person" },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("doesn't save a draft without a risk profile", () => {
    renderRule(createRule("draft"));
    fireEvent.click(changeGroup().getByRole("button", { name: en.rules.editDraft }));
    fireEvent.click(screen.getByRole("checkbox", { name: en.riskProfile.high }));
    fireEvent.click(screen.getByRole("button", { name: en.rules.saveDraft }));

    expect(updateDraftMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(en.ruleForm.validationRiskProfiles);
  });

  it("starts the review role again from a newer version brought by a refetch", () => {
    withoutDraftEditing();
    const { rerender } = renderRule(createRule("pending_for_review"));
    fireEvent.change(actionsCard().getByLabelText(en.rules.escalationRole), {
      target: { value: "contact_person" },
    });

    serveRule(createUpdatedRule());
    rerender(ruleScreen());

    expect(actionsCard().getByLabelText<HTMLSelectElement>(en.rules.escalationRole).value).toBe(
      "compliance_officer",
    );
    fireEvent.click(reviewCard().getByRole("button", { name: en.rules.action.approve }));
    expect(transitionMutate).toHaveBeenCalledWith({
      ruleId: "rule-1",
      action: "approve",
      escalationRole: "compliance_officer",
    });
  });

  it("keeps the rejection confirmation after a rejected new rule has no review action left", () => {
    rejectMutate.mockImplementation((_input, options: { onSuccess: () => void }) => options.onSuccess());
    const { rerender } = renderRule(createRule("pending_for_review"));
    fireEvent.click(reviewCard().getByRole("button", { name: en.rules.action.reject }));
    const rejectPanel = within(reviewCard().getByRole("form", { name: en.rules.rejectTitle }));
    fireEvent.change(rejectPanel.getByLabelText(en.rules.rejectComment), {
      target: { value: "Špatný práh" },
    });
    fireEvent.click(rejectPanel.getByRole("button", { name: en.rules.confirmReject }));

    serveRule({ ...createRule("inactive"), runningVersionNumber: null });
    rerender(ruleScreen());

    expect(reviewCard().getByRole("status").textContent).toBe(en.rules.actionDone);
    expect(reviewCard().queryByRole("button")).toBeNull();
  });

  it("splits a draft's actions into the review card and the changes in the actions card", () => {
    renderRule(createRule("draft"));

    const review = reviewCard();
    expect(review.getByRole("button", { name: en.rules.action.submit_for_review })).toBeTruthy();
    expect(review.getByRole("button", { name: en.rules.action.approve })).toBeTruthy();
    expect(review.getByRole("button", { name: en.rules.action.reject })).toBeTruthy();
    const changes = changeGroup();
    expect(changes.getByRole("button", { name: en.rules.editDraft })).toBeTruthy();
    expect(changes.getByRole("button", { name: en.rules.deleteRule })).toBeTruthy();
    expect(actionsCard().queryByRole("button", { name: en.rules.action.approve })).toBeNull();
    expect(actionsCard().getByRole("group", { name: en.rules.changeActions })).toBeTruthy();
  });

  it("places the review card between the actions card and the version card", () => {
    renderRule(createRule("draft"));

    const isFollowedBy = (earlier: HTMLElement, later: HTMLElement) =>
      Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
    const review = getCard(en.rules.reviewActions);
    expect(isFollowedBy(getCard(en.rules.actions), review)).toBe(true);
    expect(isFollowedBy(review, getCard(`${en.common.version} 1`))).toBe(true);
  });

  it("puts an active rule's switch under review and its new version under changes", () => {
    renderRule(createRule("active"));

    expect(reviewCard().getByRole("button", { name: en.rules.action.deactivate })).toBeTruthy();
    expect(changeGroup().getByRole("button", { name: en.rules.action.create_version })).toBeTruthy();
  });

  it("keeps the actions card for the review role without the changes group when it has no change", () => {
    jest
      .mocked(useRulesCapabilities)
      .mockReturnValue({ ...CAPABILITIES, canEditDraftContent: false, canDeleteRule: false });
    renderRule(createRule("pending_for_review"));

    expect(actionsCard().getByLabelText(en.rules.escalationRole)).toBeTruthy();
    expect(screen.queryByRole("group", { name: en.rules.changeActions })).toBeNull();
  });

  it("renders no empty actions card when there is neither a change nor a review role", () => {
    jest.mocked(useRulesCapabilities).mockReturnValue({ ...CAPABILITIES, canDeleteRule: false });
    renderRule(createRule("pending_for_review"));

    expect(queryCard(en.rules.actions)).toBeNull();
    expect(reviewCard().getByRole("button", { name: en.rules.action.approve })).toBeTruthy();
  });

  it("renders no review card for an inactive rule that never ran", () => {
    renderRule({ ...createRule("inactive"), runningVersionNumber: null });

    expect(queryCard(en.rules.reviewActions)).toBeNull();
    expect(changeGroup().getByRole("button", { name: en.rules.action.create_version })).toBeTruthy();
  });

  it("shows a non-manager one role notice and no actions", () => {
    jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("lawyer"));
    renderRule(createRule("draft"));

    expect(actionsCard().getByText(/Switch the role in the sidebar/)).toBeTruthy();
    expect(screen.getAllByText(/Switch the role in the sidebar/)).toHaveLength(1);
    expect(queryCard(en.rules.reviewActions)).toBeNull();
  });
});
