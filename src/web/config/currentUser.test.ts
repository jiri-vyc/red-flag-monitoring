import type { User } from "@/features/users/types";

import {
  DEMO_ADMIN_USER,
  forgetCurrentUserForTests,
  formatUserName,
  getCurrentUser,
  rememberUserNames,
  setActiveRole,
  setCurrentUser,
} from "./currentUser";

const ANALYST: User = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Jana Nováková",
  email: "analyst@example.com",
  roles: ["compliance_analyst"],
};
const OFFICER: User = {
  id: "00000000-0000-4000-8000-000000000003",
  name: "Petr Svoboda",
  email: "compliance@example.com",
  roles: ["compliance_officer", "contact_person"],
};

beforeEach(() => {
  window.localStorage.clear();
  forgetCurrentUserForTests();
});

describe("current user (issue #6)", () => {
  it("starts as the demo admin acting as compliance officer", () => {
    expect(getCurrentUser()).toEqual({ ...DEMO_ADMIN_USER, activeRole: "compliance_officer" });
  });

  it("keeps the active role when the new user holds it, else takes the user's first role", () => {
    setCurrentUser(OFFICER);
    expect(getCurrentUser().activeRole).toBe("compliance_officer");

    setCurrentUser(ANALYST);
    expect(getCurrentUser()).toMatchObject({ id: ANALYST.id, activeRole: "compliance_analyst" });
  });

  it("switches only to a role the user holds", () => {
    setCurrentUser(OFFICER);

    setActiveRole("contact_person");
    setActiveRole("designated_person");

    expect(getCurrentUser().activeRole).toBe("contact_person");
  });

  it("remembers the choice across a reload", () => {
    setCurrentUser(OFFICER);
    setActiveRole("contact_person");
    forgetCurrentUserForTests();

    expect(getCurrentUser()).toMatchObject({ id: OFFICER.id, activeRole: "contact_person" });
  });

  it("shows loaded users by name and unknown ids as they are", () => {
    rememberUserNames([ANALYST]);

    expect(formatUserName(ANALYST.id)).toBe("Jana Nováková");
    expect(formatUserName("unknown-id")).toBe("unknown-id");
  });
});
