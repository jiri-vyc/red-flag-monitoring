"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BlockedDeleteButton, DeleteConfirmationPanel } from "@/components/ui/DeleteConfirmation";
import { usePolicies } from "@/features/policies/api/hooks";
import { useRules } from "@/features/rules/api/hooks";
import { RoleGatedButton } from "@/features/users/components/RoleGatedButton";
import { useI18n } from "@/i18n/I18nProvider";

import { useDeleteRegulation, useRegulationsCapabilities } from "../api/hooks";
import { findRegulationDeletionBlocker, type RegulationDeletionBlocker } from "../domain/regulationDeletion";

function DeleteRegulationConfirmation({
  regulationId,
  onCancel,
}: {
  regulationId: string;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const deleteMutation = useDeleteRegulation();
  return (
    <DeleteConfirmationPanel
      title={t.regulations.deleteTitle}
      warning={t.regulations.deleteWarning}
      isPending={deleteMutation.isPending}
      error={deleteMutation.error}
      onConfirm={() => deleteMutation.mutate(regulationId, { onSuccess: () => router.push("/regulations") })}
      onCancel={onCancel}
    />
  );
}

/**
 * Deletes a regulation no policy or rule version cites, after an inline confirmation. Hidden when the API cannot,
 * and until the policies and rules it checks have loaded (the related lists on the page load the same queries).
 */
export function DeleteRegulationAction({ regulationId }: { regulationId: string }) {
  const { t } = useI18n();
  const { canDeleteRegulation } = useRegulationsCapabilities();
  const policiesQuery = usePolicies();
  const rulesQuery = useRules();
  const [isConfirming, setIsConfirming] = useState(false);
  const blockerReasons: Record<RegulationDeletionBlocker, string> = {
    cited_by_policy: t.regulations.deleteBlockedByPolicy,
    cited_by_rule: t.regulations.deleteBlockedByRule,
  };

  if (!canDeleteRegulation || !policiesQuery.data || !rulesQuery.data) {
    return null;
  }
  const blocker = findRegulationDeletionBlocker(regulationId, {
    policies: policiesQuery.data,
    rules: rulesQuery.data,
  });
  if (blocker !== null) {
    return <BlockedDeleteButton label={t.regulations.deleteRegulation} reason={blockerReasons[blocker]} />;
  }
  if (isConfirming) {
    return (
      <DeleteRegulationConfirmation regulationId={regulationId} onCancel={() => setIsConfirming(false)} />
    );
  }
  return (
    <RoleGatedButton
      permission="canCreateRegulation"
      variant="danger"
      icon={<Trash2 aria-hidden="true" />}
      onClick={() => setIsConfirming(true)}
    >
      {t.regulations.deleteRegulation}
    </RoleGatedButton>
  );
}
