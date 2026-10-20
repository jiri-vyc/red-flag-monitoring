import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import { useRolePermissions } from "../api/hooks";
import { getRolePermissions, rolesWithPermission } from "../permissions";
import { RoleGatedButton, RoleGatedButtonLink } from "./RoleGatedButton";
import { RoleGateNotice } from "./RoleGateNotice";

jest.mock("../api/hooks", () => ({ useRolePermissions: jest.fn() }));
jest.mock("../permissions", () => {
  const actualPermissions = jest.requireActual("../permissions");
  return { ...actualPermissions, rolesWithPermission: jest.fn(actualPermissions.rolesWithPermission) };
});

function renderInEnglish(children: ReactNode) {
  return render(<I18nProvider initialLocale="en">{children}</I18nProvider>);
}

beforeEach(() => {
  jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("compliance_analyst"));
});

describe("RoleGatedButtonLink (issue #6)", () => {
  it("renders the link when the active role may do the action", () => {
    renderInEnglish(
      <RoleGatedButtonLink permission="canCreateRegulation" href="/wizard">
        Add regulation
      </RoleGatedButtonLink>,
    );

    expect(screen.getByRole("link", { name: "Add regulation" }).getAttribute("href")).toBe("/wizard");
    expect(screen.queryByText(/Requires the/)).toBeNull();
  });

  it("renders a disabled button naming the role the action needs", () => {
    renderInEnglish(
      <RoleGatedButtonLink permission="canManageRules" href="/rules/new">
        New rule
      </RoleGatedButtonLink>,
    );

    const button = screen.getByRole("button", { name: "New rule" }) as HTMLButtonElement;
    const hint = screen.getByText("Requires the Compliance officer role");
    expect(screen.queryByRole("link")).toBeNull();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-describedby")).toBe(hint.id);
    expect(hint.parentElement?.getAttribute("title")).toBe(hint.textContent);
  });
});

describe("RoleGatedButton (issue #6)", () => {
  it("keeps the button enabled for a permitted role", () => {
    jest.mocked(useRolePermissions).mockReturnValue(getRolePermissions("compliance_officer"));
    renderInEnglish(<RoleGatedButton permission="canDraftRules">Retry</RoleGatedButton>);

    expect((screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables the button and does not run its action for another role", () => {
    const onClick = jest.fn();
    renderInEnglish(
      <RoleGatedButton permission="canDraftRules" onClick={onClick}>
        Retry
      </RoleGatedButton>,
    );

    const button = screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement;
    button.click();
    expect(button.disabled).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText("Requires the Compliance officer role")).toBeTruthy();
  });
});

describe("RoleGateNotice (issue #6)", () => {
  it("names the role derived from the permissions", () => {
    renderInEnglish(<RoleGateNotice permission="canDraftPolicies" />);

    expect(screen.getByText(/^Only the Compliance analyst role can do this\./)).toBeTruthy();
  });

  it("lists every role that may do the action", () => {
    jest.mocked(rolesWithPermission).mockReturnValueOnce(["compliance_officer", "designated_person"]);
    renderInEnglish(<RoleGateNotice permission="canApprovePolicy" />);

    expect(
      screen.getByText(
        `Only the ${en.roles.compliance_officer} or ${en.roles.designated_person} role can do this.`,
        { exact: false },
      ),
    ).toBeTruthy();
  });
});
