"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { formatAlternatives } from "@/lib/format";

import { useRolePermissions } from "../api/hooks";
import { rolesWithPermission, type RolePermission } from "../permissions";

type RoleRequirement = {
  isAllowed: boolean;
  /** The roles that may do it, joined for a sentence: "Compliance officer" or "A or B". */
  requiredRoles: string;
};

/** Whether the active role may do an action and, if not, which role would (issue #6). */
export function useRoleRequirement(permission: RolePermission): RoleRequirement {
  const { t, locale } = useI18n();
  const isAllowed = useRolePermissions()[permission];
  const requiredRoles = formatAlternatives(
    rolesWithPermission(permission).map((role) => t.roles[role]),
    locale,
  );
  return { isAllowed, requiredRoles };
}
