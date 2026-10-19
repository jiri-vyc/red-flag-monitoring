import { getRolePermissions } from "./permissions";

describe("getRolePermissions (issue #6)", () => {
  it("lets the compliance analyst add regulations and draft policies, nothing else", () => {
    expect(getRolePermissions("compliance_analyst")).toEqual({
      canCreateRegulation: true,
      canDraftPolicies: true,
      canApprovePolicy: false,
      canDraftRules: false,
      canManageRules: false,
    });
  });

  it("lets the compliance officer approve policies, draft and manage rules", () => {
    expect(getRolePermissions("compliance_officer")).toEqual({
      canCreateRegulation: false,
      canDraftPolicies: false,
      canApprovePolicy: true,
      canDraftRules: true,
      canManageRules: true,
    });
  });

  it.each(["lawyer", "contact_person", "designated_person"] as const)("keeps %s read-only", (role) => {
    expect(Object.values(getRolePermissions(role)).some(Boolean)).toBe(false);
  });
});
