import { z } from "zod";

import { riskProfileSchema } from "@/features/rules/types";

/** Issue #20: OPO workflow. A rejection returns the report to `draft`; `submitted` is final. */
export const FAU_REPORT_STATUSES = ["draft", "pending_approval", "approved", "submitted"] as const;
export const fauReportStatusSchema = z.enum(FAU_REPORT_STATUSES);
export type FauReportStatus = z.infer<typeof fauReportStatusSchema>;

/** MP FAÚ č. 4, section IV: which area of the AML Act the report concerns. */
export const FAU_REPORT_TYPES = [
  "money_laundering",
  "terrorist_financing",
  "proliferation_financing",
  "international_sanctions",
] as const;
export const fauReportTypeSchema = z.enum(FAU_REPORT_TYPES);
export type FauReportType = z.infer<typeof fauReportTypeSchema>;
export const DEFAULT_FAU_REPORT_TYPE: FauReportType = "money_laundering";

/** MP FAÚ č. 4, section VI: executed, not executed (§ 15) or postponed (§ 20 odst. 1 AML zákona). */
export const FAU_EXECUTION_STATUSES = ["executed", "not_executed", "postponed"] as const;
export const fauExecutionStatusSchema = z.enum(FAU_EXECUTION_STATUSES);
export type FauExecutionStatus = z.infer<typeof fauExecutionStatusSchema>;

/** MP FAÚ č. 4, part four: the secure channels an OPO may be filed through (never e-mail). */
export const FAU_SUBMISSION_CHANNELS = ["moneyweb", "fau_online_form", "data_box"] as const;
export const fauSubmissionChannelSchema = z.enum(FAU_SUBMISSION_CHANNELS);
export type FauSubmissionChannel = z.infer<typeof fauSubmissionChannelSchema>;

/** MP FAÚ č. 4, section III A) to D). The web does not know it (the dataset has no client type), so it is picked. */
export const FAU_SUBJECT_TYPES = ["natural_person", "entrepreneur", "legal_entity", "trust"] as const;
export const fauSubjectTypeSchema = z.enum(FAU_SUBJECT_TYPES);
export type FauSubjectType = z.infer<typeof fauSubjectTypeSchema>;

export const FAU_REPORT_ACTIONS = [
  "created",
  "updated",
  "submitted_for_approval",
  "approved",
  "rejected",
  "marked_submitted",
] as const;
export const fauReportActionSchema = z.enum(FAU_REPORT_ACTIONS);
export type FauReportAction = z.infer<typeof fauReportActionSchema>;

/** The user id is kept so the approver can be checked against the author (no self-approval, issue #15). */
export const fauReportActorSchema = z.object({ id: z.string(), name: z.string() });
export type FauReportActor = z.infer<typeof fauReportActorSchema>;

/**
 * The alert a report belongs to. The mock keys it by batch and transaction; the backend will key it by the
 * AML event id (#13), one active report per event.
 */
export const fauReportAlertSchema = z.object({ batchId: z.string(), transactionId: z.string() });
export type FauReportAlert = z.infer<typeof fauReportAlertSchema>;

/** MP FAÚ č. 4, section II. */
export const reportingInstitutionSchema = z.object({
  name: z.string(),
  companyId: z.string(),
  address: z.string(),
  obligedEntityType: z.string(),
});
export type ReportingInstitution = z.infer<typeof reportingInstitutionSchema>;

/**
 * MP FAÚ č. 4, section III: only what the system has (pseudonymous client). Identification data (name, birth
 * number, ID document, address) never enters the system; it is completed from KYC outside it before filing.
 */
export const fauReportSubjectSchema = z.object({
  clientId: z.string(),
  country: z.string(),
  riskProfile: riskProfileSchema,
  isPep: z.boolean(),
  subjectType: fauSubjectTypeSchema.nullable(),
});
export type FauReportSubject = z.infer<typeof fauReportSubjectSchema>;

export const fauReportExecutionSchema = z.object({ status: fauExecutionStatusSchema, note: z.string() });
export type FauReportExecution = z.infer<typeof fauReportExecutionSchema>;

export const fauReportSubmissionSchema = z.object({
  channel: fauSubmissionChannelSchema,
  /** Číslo jednací FAÚ. */
  fauReferenceNumber: z.string(),
  submittedAt: z.string(),
  submittedBy: fauReportActorSchema,
});
export type FauReportSubmission = z.infer<typeof fauReportSubmissionSchema>;

/** The web keeps a simple state history; the backend timeline will come from audit_events (#5). */
export const fauReportHistoryEntrySchema = z.object({
  action: fauReportActionSchema,
  actor: fauReportActorSchema,
  at: z.string(),
  reason: z.string().nullable(),
});
export type FauReportHistoryEntry = z.infer<typeof fauReportHistoryEntrySchema>;

export const fauReportSchema = z.object({
  id: z.string(),
  /** Section I, e.g. OPO-2026-0001. */
  referenceNumber: z.string(),
  alert: fauReportAlertSchema,
  status: fauReportStatusSchema,
  reportingInstitution: reportingInstitutionSchema,
  subject: fauReportSubjectSchema,
  reportType: fauReportTypeSchema,
  /** Section V. Prefilled from a template; the person preparing the report always reviews it. */
  description: z.string(),
  execution: fauReportExecutionSchema,
  author: fauReportActorSchema,
  approvedBy: fauReportActorSchema.nullable(),
  approvedAt: z.string().nullable(),
  submission: fauReportSubmissionSchema.nullable(),
  /** When the alert arose; the reporting period runs from it (MP FAÚ č. 4, part three, 1.). */
  alertRaisedAt: z.string(),
  /** Creating the report is the conclusion that the transaction is suspicious (SVZ-03 čl. 8.8). */
  createdAt: z.string(),
  updatedAt: z.string(),
  history: z.array(fauReportHistoryEntrySchema),
});
export type FauReport = z.infer<typeof fauReportSchema>;

/** What every role may learn about an alert's report (§ 38 AML zákona): that it exists and its state. */
export type FauReportSummary = Pick<FauReport, "id" | "status">;

/** One failed rule of the alert as section V describes it. */
export type FauReportSourceRule = {
  ruleName: string;
  ruleVersionNumber: number;
  adjustedScore: number;
  /** The met trace steps, e.g. "Částka: amount_czk (1000) > 500". */
  reasons: string[];
  /** e.g. "AML zákon § 6 odst. 1 písm. b)"; empty when the rule version is not known. */
  legalBases: string[];
};

/** The alert data a draft is prefilled from. */
export type FauReportSource = {
  alert: FauReportAlert;
  alertRaisedAt: string;
  transaction: {
    transactionId: string;
    bookedAt: string;
    amount: number;
    currency: string;
    amountCzk: number | null;
    transactionType: string;
    payerCountry: string;
    payeeCountry: string;
    payerAccount: string;
    payeeAccount: string;
  };
  client: { id: string; country: string; riskProfile: FauReportSubject["riskProfile"]; isPep: boolean };
  failedRules: FauReportSourceRule[];
};

/** The fields of sections III to VI a person may change while the report is a draft. */
export type FauReportDraftChanges = {
  subjectType: FauSubjectType | null;
  reportType: FauReportType;
  description: string;
  execution: FauReportExecution;
};

export type MarkFauReportSubmittedInput = { channel: FauSubmissionChannel; fauReferenceNumber: string };
