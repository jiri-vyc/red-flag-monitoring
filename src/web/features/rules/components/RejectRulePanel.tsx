"use client";

import { CircleX } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, fieldStyles } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/StateViews";
import type { UserRole } from "@/features/users/types";
import { useI18n } from "@/i18n/I18nProvider";

import { useRejectRule } from "../api/hooks";
import type { Rule } from "../types";
import styles from "./RejectRulePanel.module.css";

type RejectRulePanelProps = {
  ruleId: string;
  /** The escalation role picked at review (issue #6); null keeps the version's role. */
  escalationRole?: UserRole | null;
  onRejected: (rule: Rule) => void;
  onCancel: () => void;
};

/** Confirms a rejection. The reason is required: a rejection is an AML decision and is stored as the review comment. */
export function RejectRulePanel({
  ruleId,
  escalationRole = null,
  onRejected,
  onCancel,
}: RejectRulePanelProps) {
  const { t } = useI18n();
  const rejectMutation = useRejectRule();
  const commentId = useId();
  const [comment, setComment] = useState("");
  const [isCommentMissing, setIsCommentMissing] = useState(false);

  const confirmRejection = () => {
    if (comment.trim() === "") {
      setIsCommentMissing(true);
      return;
    }
    setIsCommentMissing(false);
    rejectMutation.mutate({ ruleId, comment: comment.trim(), escalationRole }, { onSuccess: onRejected });
  };

  return (
    <form
      className={styles.panel}
      noValidate
      aria-label={t.rules.rejectTitle}
      onSubmit={(event) => {
        event.preventDefault();
        confirmRejection();
      }}
    >
      <h3 className={styles.title}>{t.rules.rejectTitle}</h3>
      <Field
        label={t.rules.rejectComment}
        htmlFor={commentId}
        hint={t.rules.rejectCommentHint}
        error={isCommentMissing ? t.rules.rejectCommentRequired : null}
      >
        <textarea
          id={commentId}
          className={fieldStyles.textarea}
          value={comment}
          required
          aria-describedby={`${commentId}-hint`}
          onChange={(event) => setComment(event.target.value)}
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
          {rejectMutation.isPending ? t.rules.rejecting : t.rules.confirmReject}
        </Button>
        <Button variant="ghost" disabled={rejectMutation.isPending} onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
