"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BlockedDeleteButton, DeleteConfirmationPanel } from "@/components/ui/DeleteConfirmation";
import { RoleGatedButton } from "@/features/users/components/RoleGatedButton";
import { useI18n } from "@/i18n/I18nProvider";

import { useDeletePolicy, usePoliciesCapabilities } from "../api/hooks";
import { findPolicyDeletionBlocker, type PolicyDeletionBlocker } from "../domain/policyDeletion";
import type { Policy } from "../types";

function DeletePolicyConfirmation({ policyId, onCancel }: { policyId: string; onCancel: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const deleteMutation = useDeletePolicy();
  return (
    <DeleteConfirmationPanel
      title={t.policies.deleteTitle}
      warning={t.policies.deleteWarning}
      isPending={deleteMutation.isPending}
      error={deleteMutation.error}
      onConfirm={() => deleteMutation.mutate(policyId, { onSuccess: () => router.push("/policies") })}
      onCancel={onCancel}
    />
  );
}

/** Deletes a never-approved policy no rule derives from, after an inline confirmation. Hidden when the API cannot. */
export function DeletePolicyAction({ policy }: { policy: Policy }) {
  const { t } = useI18n();
  const { canDeletePolicy } = usePoliciesCapabilities();
  const [isConfirming, setIsConfirming] = useState(false);
  const blockerReasons: Record<PolicyDeletionBlocker, string> = {
    approved_version: t.policies.deleteBlockedApproved,
    derived_rules: t.policies.deleteBlockedByRules,
  };

  if (!canDeletePolicy) {
    return null;
  }
  const blocker = findPolicyDeletionBlocker(policy);
  if (blocker !== null) {
    return <BlockedDeleteButton label={t.policies.deletePolicy} reason={blockerReasons[blocker]} />;
  }
  if (isConfirming) {
    return <DeletePolicyConfirmation policyId={policy.id} onCancel={() => setIsConfirming(false)} />;
  }
  return (
    <RoleGatedButton
      permission="canDraftPolicies"
      variant="danger"
      icon={<Trash2 aria-hidden="true" />}
      onClick={() => setIsConfirming(true)}
    >
      {t.policies.deletePolicy}
    </RoleGatedButton>
  );
}
