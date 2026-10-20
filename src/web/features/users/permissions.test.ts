import { getRolePermissions, grantedPermissions, rolesWithPermission, ROLE_PERMISSIONS } from "./permissions";

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

describe("rolesWithPermission (issue #6)", () => {
  it.each([
    ["canCreateRegulation", ["compliance_analyst"]],
    ["canDraftPolicies", ["compliance_analyst"]],
    ["canApprovePolicy", ["compliance_officer"]],
    ["canDraftRules", ["compliance_officer"]],
    ["canManageRules", ["compliance_officer"]],
  ] as const)("derives the roles allowed to %s", (permission, roles) => {
    expect(rolesWithPermission(permission)).toEqual(roles);
  });

  it("names a role for every permission, so no gated action is left without a hint", () => {
    expect(ROLE_PERMISSIONS.every((permission) => rolesWithPermission(permission).length > 0)).toBe(true);
  });
});

describe("grantedPermissions (issue #6)", () => {
  it("lists only what the role may do", () => {
    expect(grantedPermissions("compliance_analyst")).toEqual(["canCreateRegulation", "canDraftPolicies"]);
    expect(grantedPermissions("lawyer")).toEqual([]);
  });
});
