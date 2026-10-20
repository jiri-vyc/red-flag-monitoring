import { getRolePermissions, grantedPermissions, rolesWithPermission, ROLE_PERMISSIONS } from "./permissions";

describe("getRolePermissions (issue #6)", () => {
  it("lets the compliance analyst add regulations and draft policies, nothing else", () => {
    expect(getRolePermissions("compliance_analyst")).toEqual({
      canCreateRegulation: true,
      canDraftPolicies: true,
      canApprovePolicy: false,
      canDraftRules: false,
      canManageRules: false,
      canViewFauReports: false,
      canPrepareFauReport: false,
      canApproveFauReport: false,
    });
  });

  it("lets the compliance officer approve policies, draft and manage rules, view and approve FAÚ reports", () => {
    expect(getRolePermissions("compliance_officer")).toEqual({
      canCreateRegulation: false,
      canDraftPolicies: false,
      canApprovePolicy: true,
      canDraftRules: true,
      canManageRules: true,
      canViewFauReports: true,
      canPrepareFauReport: false,
      canApproveFauReport: true,
    });
  });

  it("lets the contact person view and prepare FAÚ reports, nothing else (issue #20)", () => {
    expect(grantedPermissions("contact_person")).toEqual(["canViewFauReports", "canPrepareFauReport"]);
  });

  it.each(["lawyer", "designated_person"] as const)("keeps %s read-only", (role) => {
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
    ["canViewFauReports", ["compliance_officer", "contact_person"]],
    ["canPrepareFauReport", ["contact_person"]],
    ["canApproveFauReport", ["compliance_officer"]],
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
