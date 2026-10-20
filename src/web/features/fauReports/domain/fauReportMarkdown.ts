import { cs } from "@/i18n/cs";
import { formatDateTime } from "@/lib/format";

import type { FauReport } from "../types";

// The export is filed with the Czech FAÚ, so it is Czech whatever the UI language is.
const labels = cs.fauReports;
const REPORT_LOCALE = "cs";
const KYC_PLACEHOLDER = `_[${labels.kycMarker}]_`;

function section(title: string, lines: string[]): string {
  return [`## ${title}`, "", ...lines].join("\n");
}

const listItem = (label: string, value: string) => `- **${label}:** ${value}`;

function describeSubmission(report: FauReport): string[] {
  if (report.submission === null) {
    return [];
  }
  const { channel, fauReferenceNumber, submittedAt, submittedBy } = report.submission;
  return [
    listItem(labels.channelLabel, labels.channel[channel]),
    listItem(labels.fauReferenceNumber, fauReferenceNumber),
    listItem(labels.submittedAt, `${formatDateTime(submittedAt, REPORT_LOCALE)} (${submittedBy.name})`),
  ];
}

/** The report structured by MP FAÚ č. 4, sections I to VI, for manual filing outside the system. */
export function buildFauReportMarkdown(report: FauReport): string {
  const { reportingInstitution: institution, subject, execution } = report;
  return [
    `# ${labels.title}: ${report.referenceNumber}`,
    `> ${labels.exportNote}`,
    `${listItem(labels.statusLabel, labels.status[report.status])}\n${listItem(
      labels.author,
      report.author.name,
    )}`,
    section(labels.sections.reference, [
      listItem(labels.referenceNumber, report.referenceNumber),
      ...describeSubmission(report),
    ]),
    section(labels.sections.institution, [
      listItem(labels.institutionName, institution.name),
      listItem(labels.companyId, institution.companyId),
      listItem(labels.address, institution.address),
      listItem(labels.obligedEntityType, institution.obligedEntityType),
    ]),
    section(labels.sections.subject, [
      listItem(labels.clientId, subject.clientId),
      listItem(labels.country, subject.country),
      listItem(labels.riskProfile, cs.riskProfile[subject.riskProfile]),
      listItem(labels.pep, subject.isPep ? cs.common.yes : cs.common.no),
      listItem(
        labels.subjectTypeLabel,
        subject.subjectType === null ? KYC_PLACEHOLDER : labels.subjectType[subject.subjectType],
      ),
      listItem(labels.kycFields.fullName, KYC_PLACEHOLDER),
      listItem(labels.kycFields.birthNumber, KYC_PLACEHOLDER),
      listItem(labels.kycFields.idDocument, KYC_PLACEHOLDER),
      listItem(labels.kycFields.address, KYC_PLACEHOLDER),
    ]),
    section(labels.sections.type, [labels.reportType[report.reportType]]),
    section(labels.sections.description, [report.description]),
    section(labels.sections.execution, [
      listItem(labels.executionStatusLabel, labels.executionStatus[execution.status]),
      execution.note,
    ]),
  ].join("\n\n");
}

/** e.g. OPO-2026-0001-koncept.md */
export function fauReportMarkdownFileName(report: FauReport): string {
  return `${report.referenceNumber}-koncept.md`;
}
