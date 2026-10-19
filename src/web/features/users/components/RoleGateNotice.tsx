"use client";

import { Notice } from "@/components/ui/Notice";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";

import type { UserRole } from "../types";

/** Tells which role an action needs, in place of the hidden controls (issue #6). */
export function RoleGateNotice({ requiredRole }: { requiredRole: UserRole }) {
  const { t } = useI18n();
  return <Notice tone="info">{formatMessage(t.roleGate.requires, { role: t.roles[requiredRole] })}</Notice>;
}
