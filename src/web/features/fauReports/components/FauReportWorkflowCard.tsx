"use client";

import { CircleCheck, CircleX, Send } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldStyles } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/StateViews";
import { useCurrentUser, useRolePermissions } from "@/features/users/api/hooks";
import gatedStyles from "@/features/users/components/RoleGatedButton.module.css";
import { RoleGatedButton } from "@/features/users/components/RoleGatedButton";
import { RoleGateNotice } from "@/features/users/components/RoleGateNotice";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

import { useApproveFauReport, useMarkFauReportSubmitted, useRejectFauReport } from "../api/hooks";
import { findApprovalBlocker } from "../domain/fauReportLifecycle";
import {
  FAU_SUBMISSION_CHANNELS,
  fauSubmissionChannelSchema,
  type FauReport,
  type FauSubmissionChannel,
} from "../types";
import styles from "./FauReport.module.css";

/** A rejection is an AML decision and must carry its reason; the report goes back to draft. */
function RejectPanel({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const { t } = useI18n();
  const labels = t.fauReports;
  const rejectMutation = useRejectFauReport();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [isReasonMissing, setIsReasonMissing] = useState(false);

  const confirmRejection = () => {
    if (reason.trim() === "") {
      setIsReasonMissing(true);
      return;
    }
    setIsReasonMissing(false);
    rejectMutation.mutate({ reportId, reason: reason.trim() }, { onSuccess: onClose });
  };

  return (
    <form
      className={styles.panel}
      noValidate
      aria-label={labels.rejectTitle}
      onSubmit={(event) => {
        event.preventDefault();
        confirmRejection();
      }}
    >
      <h3 className={styles.panelTitle}>{labels.rejectTitle}</h3>
      <Field
        label={labels.rejectReason}
        htmlFor={reasonId}
        hint={labels.rejectReasonHint}
        error={isReasonMissing ? labels.rejectReasonRequired : null}
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
          {rejectMutation.isPending ? labels.rejecting : labels.confirmReject}
        </Button>
        <Button variant="ghost" disabled={rejectMutation.isPending} onClick={onClose}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}

/** The approver must not be the author (issue #15); a self-approval is disabled with the reason. */
function ApproveButton({ report }: { report: FauReport }) {
  const { t } = useI18n();
  const { id: currentUserId } = useCurrentUser();
  const { canApproveFauReport } = useRolePermissions();
  const approveMutation = useApproveFauReport();
  const hintId = useId();
  const isSelfApproval = findApprovalBlocker(report, currentUserId) === "self_approval";
  const buttonProps = {
    variant: "success" as const,
    icon: <CircleCheck aria-hidden="true" />,
    children: approveMutation.isPending ? t.fauReports.approving : t.fauReports.approve,
  };
  if (canApproveFauReport && isSelfApproval) {
    return (
      <span className={gatedStyles.gatedAction} title={t.fauReports.selfApprovalBlocked}>
        <Button {...buttonProps} disabled aria-describedby={hintId} />
        <span id={hintId} className={gatedStyles.hint}>
          {t.fauReports.selfApprovalBlocked}
        </span>
      </span>
    );
  }
  return (
    <>
      <RoleGatedButton
        permission="canApproveFauReport"
        {...buttonProps}
        disabled={approveMutation.isPending}
        onClick={() => approveMutation.mutate(report.id)}
      />
      {approveMutation.error && <ErrorState error={approveMutation.error} />}
    </>
  );
}

function PendingApprovalActions({ report }: { report: FauReport }) {
  const { t } = useI18n();
  const [isRejecting, setIsRejecting] = useState(false);
  return (
    <>
      <p className={styles.hint}>{t.fauReports.awaitingApproval}</p>
      <div className={styles.buttons}>
        <ApproveButton report={report} />
        {!isRejecting && (
          <RoleGatedButton
            permission="canApproveFauReport"
            variant="danger"
            icon={<CircleX aria-hidden="true" />}
            onClick={() => setIsRejecting(true)}
          >
            {t.fauReports.reject}
          </RoleGatedButton>
        )}
      </div>
      {isRejecting && <RejectPanel reportId={report.id} onClose={() => setIsRejecting(false)} />}
    </>
  );
}

/** The filing happens outside the system; the contact person records the channel and the FAÚ reference number. */
function MarkSubmittedPanel({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const { t } = useI18n();
  const labels = t.fauReports;
  const markMutation = useMarkFauReportSubmitted();
  const channelId = useId();
  const referenceId = useId();
  const [channel, setChannel] = useState<FauSubmissionChannel>(FAU_SUBMISSION_CHANNELS[0]);
  const [fauReferenceNumber, setFauReferenceNumber] = useState("");
  const [isReferenceMissing, setIsReferenceMissing] = useState(false);

  const confirm = () => {
    if (fauReferenceNumber.trim() === "") {
      setIsReferenceMissing(true);
      return;
    }
    setIsReferenceMissing(false);
    markMutation.mutate(
      { reportId, channel, fauReferenceNumber: fauReferenceNumber.trim() },
      { onSuccess: onClose },
    );
  };

  return (
    <form
      className={styles.panel}
      noValidate
      aria-label={labels.markSubmittedTitle}
      onSubmit={(event) => {
        event.preventDefault();
        confirm();
      }}
    >
      <h3 className={styles.panelTitle}>{labels.markSubmittedTitle}</h3>
      <Field label={labels.channelLabel} htmlFor={channelId}>
        <select
          id={channelId}
          className={fieldStyles.select}
          value={channel}
          onChange={(event) => setChannel(fauSubmissionChannelSchema.parse(event.target.value))}
        >
          {FAU_SUBMISSION_CHANNELS.map((submissionChannel) => (
            <option key={submissionChannel} value={submissionChannel}>
              {labels.channel[submissionChannel]}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={labels.fauReferenceNumber}
        htmlFor={referenceId}
        error={isReferenceMissing ? labels.fauReferenceNumberRequired : null}
      >
        <input
          id={referenceId}
          className={fieldStyles.input}
          value={fauReferenceNumber}
          required
          onChange={(event) => setFauReferenceNumber(event.target.value)}
        />
      </Field>
      {markMutation.error && <ErrorState error={markMutation.error} />}
      <div className={styles.buttons}>
        <Button type="submit" icon={<Send aria-hidden="true" />} disabled={markMutation.isPending}>
          {markMutation.isPending ? labels.markingSubmitted : labels.confirmMarkSubmitted}
        </Button>
        <Button variant="ghost" disabled={markMutation.isPending} onClick={onClose}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}

function ApprovedActions({ report }: { report: FauReport }) {
  const { t } = useI18n();
  const [isMarking, setIsMarking] = useState(false);
  return (
    <>
      <p className={styles.hint}>{t.fauReports.awaitingFiling}</p>
      {isMarking ? (
        <MarkSubmittedPanel reportId={report.id} onClose={() => setIsMarking(false)} />
      ) : (
        <div className={styles.buttons}>
          <RoleGatedButton
            permission="canPrepareFauReport"
            icon={<Send aria-hidden="true" />}
            onClick={() => setIsMarking(true)}
          >
            {t.fauReports.markSubmitted}
          </RoleGatedButton>
        </div>
      )}
    </>
  );
}

function SubmittedSummary({ report }: { report: FauReport }) {
  const { t, locale } = useI18n();
  if (report.submission === null) {
    return null;
  }
  const { channel, fauReferenceNumber, submittedAt } = report.submission;
  return (
    <p className={styles.successNote}>
      {t.fauReports.submittedAt} {formatDateTime(submittedAt, locale)} · {t.fauReports.channel[channel]} ·{" "}
      {fauReferenceNumber}
    </p>
  );
}

/** A preparer edits and submits the draft in the form below; other roles learn who may. */
function DraftActions() {
  const { t } = useI18n();
  const { canPrepareFauReport } = useRolePermissions();
  return canPrepareFauReport ? (
    <p className={styles.hint}>{t.fauReports.draftHint}</p>
  ) : (
    <RoleGateNotice permission="canPrepareFauReport" />
  );
}

export function FauReportWorkflowCard({ report }: { report: FauReport }) {
  const { t } = useI18n();
  const content = {
    draft: <DraftActions />,
    pending_approval: <PendingApprovalActions report={report} />,
    approved: <ApprovedActions report={report} />,
    submitted: <SubmittedSummary report={report} />,
  }[report.status];
  return (
    <Card title={t.fauReports.workflowTitle}>
      <div className={styles.workflow}>{content}</div>
    </Card>
  );
}
