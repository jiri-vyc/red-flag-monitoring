"use client";

import { CircleX } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, fieldStyles } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/StateViews";
import { useI18n } from "@/i18n/I18nProvider";

import { useRejectPolicy } from "../api/hooks";
import type { Policy } from "../types";
import styles from "./RejectPolicyPanel.module.css";

type RejectPolicyPanelProps = {
  policyId: string;
  onRejected: (policy: Policy) => void;
  onCancel: () => void;
};

/**
 * Confirms the rejection of the policy's latest version. The reason is required: a rejection is a human AML review
 * decision and is stored as the version's review comment in the audit trail.
 */
export function RejectPolicyPanel({ policyId, onRejected, onCancel }: RejectPolicyPanelProps) {
  const { t } = useI18n();
  const rejectMutation = useRejectPolicy();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [isReasonMissing, setIsReasonMissing] = useState(false);

  const confirmRejection = () => {
    if (reason.trim() === "") {
      setIsReasonMissing(true);
      return;
    }
    setIsReasonMissing(false);
    // Not mutate's onSuccess: the refetched, rejected policy may unmount this panel before it would run.
    void rejectMutation.mutateAsync({ policyId, reason: reason.trim() }).then(onRejected, () => undefined);
  };

  return (
    <form
      className={styles.panel}
      noValidate
      aria-label={t.policies.rejectTitle}
      onSubmit={(event) => {
        event.preventDefault();
        confirmRejection();
      }}
    >
      <h3 className={styles.title}>{t.policies.rejectTitle}</h3>
      <Field
        label={t.policies.rejectReason}
        htmlFor={reasonId}
        hint={t.policies.rejectReasonHint}
        error={isReasonMissing ? t.policies.rejectReasonRequired : null}
      >
        <textarea
          id={reasonId}
          className={fieldStyles.textarea}
          value={reason}
          required
          aria-describedby={`${reasonId}-hint`}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {rejectMutation.error && <ErrorState error={rejectMutation.error} />}
      <div className={styles.buttons}>
        <Button
          type="submit"
          variant="danger"
          icon={<CircleX aria-hidden="true" />}
          disabled={rejectMutation.isPending}
        >
          {rejectMutation.isPending ? t.policies.rejecting : t.policies.confirmReject}
        </Button>
        <Button variant="ghost" disabled={rejectMutation.isPending} onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
