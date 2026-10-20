"use client";

import { Notice } from "@/components/ui/Notice";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";

import type { RolePermission } from "../permissions";
import { useRoleRequirement } from "./useRoleRequirement";

/** Tells which role an action needs, in place of the hidden controls (issue #6). */
export function RoleGateNotice({ permission }: { permission: RolePermission }) {
  const { t } = useI18n();
  const { requiredRoles } = useRoleRequirement(permission);
  return <Notice tone="info">{formatMessage(t.roleGate.requires, { role: requiredRoles })}</Notice>;
}
