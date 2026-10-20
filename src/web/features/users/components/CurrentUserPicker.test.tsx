import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { DEMO_ADMIN_USER } from "@/config/currentUser";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import { useCurrentUser, useUsers } from "../api/hooks";
import { CurrentUserPicker } from "./CurrentUserPicker";

jest.mock("../api/hooks", () => ({ useCurrentUser: jest.fn(), useUsers: jest.fn() }));

beforeEach(() => {
  jest.mocked(useCurrentUser).mockReturnValue({ ...DEMO_ADMIN_USER, activeRole: "compliance_analyst" });
  jest.mocked(useUsers).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useUsers>);
});

function renderPicker() {
  render(
    <I18nProvider initialLocale="en">
      <CurrentUserPicker />
    </I18nProvider>,
  );
  return {
    trigger: screen.getByRole("button", { name: en.rolesGuide.trigger }),
    tooltip: screen.getByRole("tooltip", { hidden: true }),
  };
}

describe("CurrentUserPicker roles tooltip (issue #6)", () => {
  it("is closed until the user icon is hovered, and describes the icon", () => {
    const { trigger, tooltip } = renderPicker();
    expect(tooltip.hidden).toBe(true);
    expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);

    fireEvent.mouseEnter(trigger);

    expect(tooltip.hidden).toBe(false);
    expect(tooltip.parentElement).toBe(document.body);
  });

  it("lists every role with what it may do, marking the active role", () => {
    const { trigger, tooltip } = renderPicker();
    fireEvent.mouseEnter(trigger);

    const analystSection = within(tooltip)
      .getByText(en.roles.compliance_analyst)
      .closest("li") as HTMLElement;
    expect(within(analystSection).getByText(en.rolesGuide.active)).toBeTruthy();
    expect(within(analystSection).getByText(en.rolesGuide.permissions.canCreateRegulation)).toBeTruthy();
    expect(within(analystSection).queryByText(en.rolesGuide.permissions.canApprovePolicy)).toBeNull();

    const officerSection = within(tooltip)
      .getByText(en.roles.compliance_officer)
      .closest("li") as HTMLElement;
    expect(within(officerSection).queryByText(en.rolesGuide.active)).toBeNull();
    expect(within(officerSection).getByText(en.rolesGuide.legalBasis.compliance_officer)).toBeTruthy();

    const contactSection = within(tooltip).getByText(en.roles.contact_person).closest("li") as HTMLElement;
    expect(within(contactSection).getByText(en.rolesGuide.defaultEscalationHits)).toBeTruthy();
  });

  it("opens on keyboard focus and closes on Escape", () => {
    const { trigger, tooltip } = renderPicker();

    act(() => trigger.focus());
    expect(tooltip.hidden).toBe(false);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(tooltip.hidden).toBe(true);
  });
});
