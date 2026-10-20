"use client";

import { CircleCheck, CircleX, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/StateViews";
import { useI18n } from "@/i18n/I18nProvider";

import { useApprovePolicy, useUpdatePolicyText } from "../api/hooks";
import { isPolicyRejected } from "../domain/policyRejection";
import type { Policy, PolicyApproval } from "../types";
import styles from "./PolicyDetailScreen.module.css";
import { PolicyTextField } from "./PolicyTextField";
import { RejectPolicyPanel } from "./RejectPolicyPanel";

type PolicyTextEditorProps = {
  policy: Policy;
  /** Approve and reject, both gated by `canApprovePolicy`. */
  showReviewActions?: boolean;
  onApproved?: (approval: PolicyApproval) => void;
};

/**
 * Editable text of a draft policy, with save, approve and reject actions. A rejected latest version awaits no review,
 * so only saving is offered: the saved text becomes a new version to review.
 */
export function PolicyTextEditor({ policy, showReviewActions = true, onApproved }: PolicyTextEditorProps) {
  const { t } = useI18n();
  const [draftText, setDraftText] = useState(policy.text);
  const [isRejecting, setIsRejecting] = useState(false);
  const updateTextMutation = useUpdatePolicyText();
  const approveMutation = useApprovePolicy();
  const hasUnsavedChanges = draftText !== policy.text;
  const canReview = showReviewActions && !isPolicyRejected(policy);
  const editorId = `policy-text-${policy.id}`;

  return (
    <div className={styles.editor}>
      <PolicyTextField
        id={editorId}
        value={draftText}
        onChange={setDraftText}
        textAreaClassName={styles.textArea}
      />
      <div className={styles.editorActions}>
        <Button
          variant="secondary"
          icon={<Save aria-hidden="true" />}
          disabled={!hasUnsavedChanges || updateTextMutation.isPending}
          onClick={() => updateTextMutation.mutate({ policyId: policy.id, text: draftText })}
        >
          {updateTextMutation.isPending ? t.common.saving : t.common.save}
        </Button>
        {canReview && (
          <>
            <Button
              variant="success"
              icon={<CircleCheck aria-hidden="true" />}
              disabled={hasUnsavedChanges || approveMutation.isPending || isRejecting}
              // Not mutate's onSuccess: the refetched, approved policy unmounts this editor before it would run.
              onClick={() => void approveMutation.mutateAsync(policy.id).then(onApproved, () => undefined)}
            >
              {t.policies.approve}
            </Button>
            <Button
              variant="danger"
              icon={<CircleX aria-hidden="true" />}
              disabled={hasUnsavedChanges || approveMutation.isPending || isRejecting}
              onClick={() => setIsRejecting(true)}
            >
              {t.policies.reject}
            </Button>
          </>
        )}
        {updateTextMutation.isSuccess && !hasUnsavedChanges && (
          <span className={styles.savedNote} role="status">
            {t.policies.saved}
          </span>
        )}
      </div>
      {/* Unsaved edits would not be the rejected wording, so the panel waits for them to be saved or undone.
          The refetched, rejected policy remounts this editor (keyed by its update time), which closes the panel. */}
      {canReview && isRejecting && !hasUnsavedChanges && (
        <RejectPolicyPanel
          policyId={policy.id}
          onRejected={() => setIsRejecting(false)}
          onCancel={() => setIsRejecting(false)}
        />
      )}
      {(updateTextMutation.error || approveMutation.error) && (
        <ErrorState error={updateTextMutation.error ?? approveMutation.error} />
      )}
    </div>
  );
}
