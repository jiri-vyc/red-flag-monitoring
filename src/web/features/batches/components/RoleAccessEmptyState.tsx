"use client";

import { LoadingRing } from "@/components/ui/LoadingRing";
import { EmptyState } from "@/components/ui/StateViews";
import { useCurrentUser } from "@/features/users/api/hooks";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";

import { useBucketRoleAccess } from "../api/hooks";
import type { Bucket } from "../types";

/**
 * Issue #6: shown when the bucket has transactions but none is escalated to the active role. Names the roles
 * that see them; falls back to the generic empty text when no other role sees anything or the lookup fails.
 */
export function RoleAccessEmptyState({ batchId, bucket }: { batchId: string; bucket: Bucket }) {
  const { t } = useI18n();
  const { activeRole } = useCurrentUser();
  const roleAccess = useBucketRoleAccess({ batchId, bucket });

  if (roleAccess.isPending) {
    return <LoadingRing label={t.common.loading} />;
  }
  if (roleAccess.isError || roleAccess.rolesWithAccess.length === 0) {
    return <EmptyState message={t.batches.noTransactions} />;
  }

  const message = formatMessage(t.batches.roleNoAccess, {
    role: t.roles[activeRole],
    roles: roleAccess.rolesWithAccess.map((role) => t.roles[role]).join(", "),
  });
  return <EmptyState message={message} />;
}
