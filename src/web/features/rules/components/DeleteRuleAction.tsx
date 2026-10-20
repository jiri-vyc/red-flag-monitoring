"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BlockedDeleteButton, DeleteConfirmationPanel } from "@/components/ui/DeleteConfirmation";
import { RoleGatedButton } from "@/features/users/components/RoleGatedButton";
import { useI18n } from "@/i18n/I18nProvider";

import { useDeleteRule, useRulesCapabilities } from "../api/hooks";
import { canDeleteRule } from "../domain/ruleLifecycle";
import type { Rule } from "../types";

function DeleteRuleConfirmation({ ruleId, onCancel }: { ruleId: string; onCancel: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const deleteMutation = useDeleteRule();
  return (
    <DeleteConfirmationPanel
      title={t.rules.deleteTitle}
      warning={t.rules.deleteWarning}
      isPending={deleteMutation.isPending}
      error={deleteMutation.error}
      onConfirm={() => deleteMutation.mutate(ruleId, { onSuccess: () => router.push("/rules") })}
      onCancel={onCancel}
    />
  );
}

/** Deletes a rule that never had an approved version, after an inline confirmation. Hidden when the API cannot delete. */
export function DeleteRuleAction({ rule }: { rule: Rule }) {
  const { t } = useI18n();
  const { canDeleteRule: isDeleteSupported } = useRulesCapabilities();
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isDeleteSupported) {
    return null;
  }
  // An approved rule may have been used in an evaluation.
  if (!canDeleteRule(rule)) {
    return <BlockedDeleteButton label={t.rules.deleteRule} reason={t.rules.deleteNotAllowed} />;
  }
  if (isConfirming) {
    return <DeleteRuleConfirmation ruleId={rule.id} onCancel={() => setIsConfirming(false)} />;
  }
  return (
    <RoleGatedButton
      permission="canManageRules"
      variant="danger"
      icon={<Trash2 aria-hidden="true" />}
      onClick={() => setIsConfirming(true)}
    >
      {t.rules.deleteRule}
    </RoleGatedButton>
  );
}
