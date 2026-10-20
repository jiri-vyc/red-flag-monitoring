import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { usePolicies } from "@/features/policies/api/hooks";
import type { Policy } from "@/features/policies/types";
import { useRules } from "@/features/rules/api/hooks";
import type { Rule } from "@/features/rules/types";
import { useRolePermissions } from "@/features/users/api/hooks";
import { getRolePermissions } from "@/features/users/permissions";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import { useDeleteRegulation, useRegulationsCapabilities } from "../api/hooks";
import { DeleteRegulationAction } from "./DeleteRegulationAction";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/features/users/api/hooks", () => ({ useRolePermissions: jest.fn() }));
jest.mock("@/features/policies/api/hooks", () => ({ usePolicies: jest.fn() }));
jest.mock("@/features/rules/api/hooks", () => ({ useRules: jest.fn() }));
jest.mock("../api/hooks", () => ({ useDeleteRegulation: jest.fn(), useRegulationsCapabilities: jest.fn() }));

const CITATION = { regulationId: "reg-1", ref: "§ 6" };
// The check reads only the legal bases, so the fixtures carry just those.
const CITING_POLICY = { legalBases: [CITATION], versions: [{ legalBases: [CITATION] }] } as unknown as Policy;
const CITING_RULE = { versions: [{ legalBases: [CITATION] }] } as unknown as Rule;

const mutate = jest.fn();

function mockCitations({ policies = [], rules = [] }: { policies?: Policy[]; rules?: Rule[] }) {
  jest.mocked(usePolicies).mockReturnValue({ data: policies } as unknown as ReturnType<typeof usePolicies>);
  jest.mocked(useRules).mockReturnValue({ data: rules } as unknown as ReturnType<typeof useRules>);
}

function renderInEnglish(children: ReactNode) {
  return render(<I18nProvider initialLocale="en">{children}</I18nProvider>);
}

const deleteButton = () =>
  screen.getByRole("button", { name: en.regulations.deleteRegulation }) as HTMLButtonElement;

beforeEach(() => {
  mutate.mockReset();
  push.mockReset();
  mockCitations({});
  jest.mocked(useRegulationsCapabilities).mockReturnValue({ canDeleteRegulation: true });
  jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("compliance_analyst"));
  jest.mocked(useDeleteRegulation).mockReturnValue({
    mutate,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useDeleteRegulation>);
});

describe("DeleteRegulationAction", () => {
  it("deletes an uncited regulation after confirmation and returns to the regulation list", () => {
    mutate.mockImplementation((_id: string, options: { onSuccess: () => void }) => options.onSuccess());
    renderInEnglish(<DeleteRegulationAction regulationId="reg-1" />);

    fireEvent.click(deleteButton());
    expect(screen.getByText(en.regulations.deleteWarning)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.common.delete }));

    expect(mutate).toHaveBeenCalledWith(
      "reg-1",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(push).toHaveBeenCalledWith("/regulations");
  });

  it("disables the button with the reason when a policy cites the regulation", () => {
    mockCitations({ policies: [CITING_POLICY] });
    renderInEnglish(<DeleteRegulationAction regulationId="reg-1" />);

    const reason = screen.getByText(en.regulations.deleteBlockedByPolicy);
    expect(deleteButton().disabled).toBe(true);
    expect(deleteButton().getAttribute("aria-describedby")).toBe(reason.id);
  });

  it("disables the button with the reason when a rule version cites the regulation", () => {
    mockCitations({ rules: [CITING_RULE] });
    renderInEnglish(<DeleteRegulationAction regulationId="reg-1" />);

    expect(screen.getByText(en.regulations.deleteBlockedByRule)).toBeTruthy();
    expect(deleteButton().disabled).toBe(true);
  });

  it("disables the button naming the role for a role that cannot add regulations", () => {
    jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("compliance_officer"));
    renderInEnglish(<DeleteRegulationAction regulationId="reg-1" />);

    expect(deleteButton().disabled).toBe(true);
    expect(screen.getByText(`Requires the ${en.roles.compliance_analyst} role`)).toBeTruthy();
  });

  it("renders nothing when the API cannot delete regulations (live)", () => {
    jest.mocked(useRegulationsCapabilities).mockReturnValue({ canDeleteRegulation: false });
    const { container } = renderInEnglish(<DeleteRegulationAction regulationId="reg-1" />);

    expect(container.textContent).toBe("");
  });
});
