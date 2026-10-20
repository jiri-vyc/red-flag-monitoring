import { USER_ROLES, type UserRole } from "./types";

/**
 * Issue #6: what the active role may do on the web. Only the UI hides actions; the backend checks no permissions
 * (no auth in the MVP), so this is a demo of the separation of duties, not access control.
 */
export type RolePermissions = {
  canCreateRegulation: boolean;
  canDraftPolicies: boolean;
  canApprovePolicy: boolean;
  canDraftRules: boolean;
  canManageRules: boolean;
  /** Issue #20, § 38 AML zákona: OPO content is visible to these roles only; others see that a report exists. */
  canViewFauReports: boolean;
  /** Create and edit an OPO draft, submit it for approval and record its filing (§ 22). */
  canPrepareFauReport: boolean;
  /** Approve or reject an OPO draft; never one the user authored (issue #15). */
  canApproveFauReport: boolean;
};

export type RolePermission = keyof RolePermissions;

const NO_PERMISSIONS: RolePermissions = {
  canCreateRegulation: false,
  canDraftPolicies: false,
  canApprovePolicy: false,
  canDraftRules: false,
  canManageRules: false,
  canViewFauReports: false,
  canPrepareFauReport: false,
  canApproveFauReport: false,
};

/** Every permission, in the order the roles tooltip lists them. */
export const ROLE_PERMISSIONS = Object.keys(NO_PERMISSIONS) as RolePermission[];

const PERMISSIONS_BY_ROLE: Record<UserRole, RolePermissions> = {
  compliance_analyst: { ...NO_PERMISSIONS, canCreateRegulation: true, canDraftPolicies: true },
  compliance_officer: {
    ...NO_PERMISSIONS,
    canApprovePolicy: true,
    canDraftRules: true,
    canManageRules: true,
    canViewFauReports: true,
    canApproveFauReport: true,
  },
  lawyer: NO_PERMISSIONS,
  contact_person: { ...NO_PERMISSIONS, canViewFauReports: true, canPrepareFauReport: true },
  designated_person: NO_PERMISSIONS,
};

export function getRolePermissions(role: UserRole): RolePermissions {
  return PERMISSIONS_BY_ROLE[role];
}

/** The roles that may perform an action, so a gated action can say which role to switch to. */
export function rolesWithPermission(permission: RolePermission): UserRole[] {
  return USER_ROLES.filter((role) => PERMISSIONS_BY_ROLE[role][permission]);
}

/** What a role may do, e.g. for describing the roles to the user. */
export function grantedPermissions(role: UserRole): RolePermission[] {
  return ROLE_PERMISSIONS.filter((permission) => PERMISSIONS_BY_ROLE[role][permission]);
}
