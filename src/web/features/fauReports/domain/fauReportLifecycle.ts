import type {
  FauReport,
  FauReportAction,
  FauReportActor,
  FauReportAlert,
  FauReportDraftChanges,
  FauReportStatus,
  MarkFauReportSubmittedInput,
} from "../types";

/** A transition the workflow forbids; the mock maps it to a validation ApiError. */
export class FauReportTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FauReportTransitionError";
  }
}

type TransitionContext = { actor: FauReportActor; now: string };

function assertStatus(report: FauReport, expectedStatus: FauReportStatus, actionLabel: string): void {
  if (report.status !== expectedStatus) {
    throw new FauReportTransitionError(
      `Cannot ${actionLabel} report ${report.referenceNumber} in status "${report.status}"; it must be "${expectedStatus}".`,
    );
  }
}

function withHistory(
  report: FauReport,
  {
    action,
    actor,
    now,
    reason = null,
  }: TransitionContext & { action: FauReportAction; reason?: string | null },
): FauReport {
  return { ...report, updatedAt: now, history: [...report.history, { action, actor, at: now, reason }] };
}

/** Only a draft can be changed (issue #20); every later state is what was approved or filed. */
export function canEditFauReport(report: FauReport): boolean {
  return report.status === "draft";
}

/** Conflict of interest (issue #15): the compliance officer who approves must not be the draft's author. */
export function findApprovalBlocker(report: FauReport, approverId: string): "self_approval" | null {
  return report.author.id === approverId ? "self_approval" : null;
}

export function updateFauReportDraft(
  report: FauReport,
  { changes, actor, now }: TransitionContext & { changes: FauReportDraftChanges },
): FauReport {
  assertStatus(report, "draft", "edit");
  const updatedReport: FauReport = {
    ...report,
    subject: { ...report.subject, subjectType: changes.subjectType },
    reportType: changes.reportType,
    description: changes.description,
    execution: changes.execution,
  };
  return withHistory(updatedReport, { action: "updated", actor, now });
}

export function submitFauReportForApproval(report: FauReport, context: TransitionContext): FauReport {
  assertStatus(report, "draft", "submit for approval");
  if (report.description.trim() === "") {
    throw new FauReportTransitionError("A report needs a description (section V) before approval.");
  }
  return withHistory(
    { ...report, status: "pending_approval" },
    { ...context, action: "submitted_for_approval" },
  );
}

export function approveFauReport(report: FauReport, context: TransitionContext): FauReport {
  assertStatus(report, "pending_approval", "approve");
  if (findApprovalBlocker(report, context.actor.id) === "self_approval") {
    throw new FauReportTransitionError("The author of a report cannot approve it.");
  }
  return withHistory(
    { ...report, status: "approved", approvedBy: context.actor, approvedAt: context.now },
    { ...context, action: "approved" },
  );
}

/** A rejection is an AML decision and must carry its reason; the report goes back to draft. */
export function rejectFauReport(
  report: FauReport,
  { reason, ...context }: TransitionContext & { reason: string },
): FauReport {
  assertStatus(report, "pending_approval", "reject");
  const trimmedReason = reason.trim();
  if (trimmedReason === "") {
    throw new FauReportTransitionError("A rejection needs a reason.");
  }
  return withHistory(
    { ...report, status: "draft" },
    { ...context, action: "rejected", reason: trimmedReason },
  );
}

/** The report is filed by a person outside the system; this only records that it happened (§ 22). */
export function markFauReportSubmitted(
  report: FauReport,
  { channel, fauReferenceNumber, ...context }: TransitionContext & MarkFauReportSubmittedInput,
): FauReport {
  assertStatus(report, "approved", "mark as submitted");
  const trimmedReferenceNumber = fauReferenceNumber.trim();
  if (trimmedReferenceNumber === "") {
    throw new FauReportTransitionError("Marking a report as submitted needs the FAÚ reference number.");
  }
  const submission = {
    channel,
    fauReferenceNumber: trimmedReferenceNumber,
    submittedAt: context.now,
    submittedBy: context.actor,
  };
  return withHistory(
    { ...report, status: "submitted", submission },
    { ...context, action: "marked_submitted" },
  );
}

const isSameAlert = (left: FauReportAlert, right: FauReportAlert) =>
  left.batchId === right.batchId && left.transactionId === right.transactionId;

/**
 * At most one active report per alert. Every status counts as active: the workflow has no withdrawn state
 * yet, and a submitted report stays the alert's report.
 */
export function findActiveReportForAlert(reports: FauReport[], alert: FauReportAlert): FauReport | null {
  return reports.find((report) => isSameAlert(report.alert, alert)) ?? null;
}

export function assertNoActiveReportForAlert(reports: FauReport[], alert: FauReportAlert): void {
  const activeReport = findActiveReportForAlert(reports, alert);
  if (activeReport !== null) {
    throw new FauReportTransitionError(
      `Alert ${alert.transactionId} already has the active report ${activeReport.referenceNumber}.`,
    );
  }
}

const REFERENCE_NUMBER_PREFIX = "OPO";
const REFERENCE_SEQUENCE_DIGITS = 4;

/** Section I: OPO-<year>-<sequence>, the sequence restarting every year. */
export function nextFauReportReferenceNumber(existingReferenceNumbers: string[], now: string): string {
  const yearPrefix = `${REFERENCE_NUMBER_PREFIX}-${new Date(now).getUTCFullYear()}-`;
  const highestSequence = existingReferenceNumbers
    .filter((referenceNumber) => referenceNumber.startsWith(yearPrefix))
    .map((referenceNumber) => Number(referenceNumber.slice(yearPrefix.length)))
    .filter(Number.isInteger)
    .reduce((highest, sequence) => Math.max(highest, sequence), 0);
  return `${yearPrefix}${String(highestSequence + 1).padStart(REFERENCE_SEQUENCE_DIGITS, "0")}`;
}
