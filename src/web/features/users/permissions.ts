import type { UserRole } from "./types";

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
};

const NO_PERMISSIONS: RolePermissions = {
  canCreateRegulation: false,
  canDraftPolicies: false,
  canApprovePolicy: false,
  canDraftRules: false,
  canManageRules: false,
};

const PERMISSIONS_BY_ROLE: Record<UserRole, RolePermissions> = {
  compliance_analyst: { ...NO_PERMISSIONS, canCreateRegulation: true, canDraftPolicies: true },
  compliance_officer: {
    ...NO_PERMISSIONS,
    canApprovePolicy: true,
    canDraftRules: true,
    canManageRules: true,
  },
  lawyer: NO_PERMISSIONS,
  contact_person: NO_PERMISSIONS,
  designated_person: NO_PERMISSIONS,
};

export function getRolePermissions(role: UserRole): RolePermissions {
  return PERMISSIONS_BY_ROLE[role];
}
