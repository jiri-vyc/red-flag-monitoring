import type {
  FauReport,
  FauReportActor,
  FauReportAlert,
  FauReportDraftChanges,
  FauReportSource,
  FauReportSummary,
  MarkFauReportSubmittedInput,
} from "../types";

/**
 * The web hands over the alert data it has loaded. The backend will take only the AML event id
 * (POST /api/aml-events/:id/fau-reports) and read the alert data itself.
 */
export type CreateFauReportInput = { source: FauReportSource; actor: FauReportActor };
export type UpdateFauReportDraftInput = {
  reportId: string;
  changes: FauReportDraftChanges;
  actor: FauReportActor;
};
export type FauReportTransitionInput = { reportId: string; actor: FauReportActor };
export type RejectFauReportInput = FauReportTransitionInput & { reason: string };
export type MarkFauReportSubmittedRequest = FauReportTransitionInput & MarkFauReportSubmittedInput;

/** What the active implementation supports. The UI hides actions that are false instead of letting them fail. */
export type FauReportsCapabilities = {
  /** Prepare, approve and record FAÚ reports (issue #20); the backend `fau_reports` API does not exist yet. */
  canUseFauReports: boolean;
};

export interface FauReportsService {
  readonly capabilities: FauReportsCapabilities;
  /** Every role may learn that an alert has a report and its state, nothing more (§ 38 AML zákona). */
  findReportForAlert(alert: FauReportAlert): Promise<FauReportSummary | null>;
  loadReport(reportId: string): Promise<FauReport>;
  /** One active report per alert; a second one is refused. */
  createReport(input: CreateFauReportInput): Promise<FauReport>;
  /** Only in `draft`. */
  updateDraft(input: UpdateFauReportDraftInput): Promise<FauReport>;
  submitForApproval(input: FauReportTransitionInput): Promise<FauReport>;
  /** Refused when the actor is the draft's author. */
  approve(input: FauReportTransitionInput): Promise<FauReport>;
  /** Back to `draft`; the reason is required. */
  reject(input: RejectFauReportInput): Promise<FauReport>;
  /** Records the filing done outside the system, with the channel and the FAÚ reference number. */
  markSubmitted(input: MarkFauReportSubmittedRequest): Promise<FauReport>;
}
