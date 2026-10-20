"use client";

import { CircleCheck, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/StateViews";
import { useI18n } from "@/i18n/I18nProvider";

import { useApprovePolicy, useUpdatePolicyText } from "../api/hooks";
import type { Policy, PolicyApproval } from "../types";
import styles from "./PolicyDetailScreen.module.css";
import { PolicyTextField } from "./PolicyTextField";

type PolicyTextEditorProps = {
  policy: Policy;
  showApprove?: boolean;
  onApproved?: (approval: PolicyApproval) => void;
};

/** Editable text of a draft policy, with save and approve actions. */
export function PolicyTextEditor({ policy, showApprove = true, onApproved }: PolicyTextEditorProps) {
  const { t } = useI18n();
  const [draftText, setDraftText] = useState(policy.text);
  const updateTextMutation = useUpdatePolicyText();
  const approveMutation = useApprovePolicy();
  const hasUnsavedChanges = draftText !== policy.text;
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
        {showApprove && (
          <Button
            variant="success"
            icon={<CircleCheck aria-hidden="true" />}
            disabled={hasUnsavedChanges || approveMutation.isPending}
            // Not mutate's onSuccess: the refetched, approved policy unmounts this editor before it would run.
            onClick={() => void approveMutation.mutateAsync(policy.id).then(onApproved, () => undefined)}
          >
            {t.policies.approve}
          </Button>
        )}
        {updateTextMutation.isSuccess && !hasUnsavedChanges && (
          <span className={styles.savedNote} role="status">
            {t.policies.saved}
          </span>
        )}
      </div>
      {(updateTextMutation.error || approveMutation.error) && (
        <ErrorState error={updateTextMutation.error ?? approveMutation.error} />
      )}
    </div>
  );
}
