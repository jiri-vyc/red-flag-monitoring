"use client";

import { Save, Send } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldStyles } from "@/components/ui/Field";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { Notice } from "@/components/ui/Notice";
import { ErrorState } from "@/components/ui/StateViews";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

import { useSaveFauReportDraft } from "../api/hooks";
import {
  FAU_EXECUTION_STATUSES,
  FAU_REPORT_TYPES,
  FAU_SUBJECT_TYPES,
  fauExecutionStatusSchema,
  fauReportTypeSchema,
  fauSubjectTypeSchema,
  type FauReport,
  type FauReportDraftChanges,
} from "../types";
import styles from "./FauReport.module.css";

const KYC_FIELDS = ["fullName", "birthNumber", "idDocument", "address"] as const;
const NO_SUBJECT_TYPE = "";

function toDraftChanges(report: FauReport): FauReportDraftChanges {
  return {
    subjectType: report.subject.subjectType,
    reportType: report.reportType,
    description: report.description,
    execution: report.execution,
  };
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title} className={styles.section}>
      {children}
    </Card>
  );
}

function ReferenceSection({ report }: { report: FauReport }) {
  const { t, locale } = useI18n();
  const labels = t.fauReports;
  const submissionItems =
    report.submission === null
      ? []
      : [
          { label: labels.channelLabel, value: labels.channel[report.submission.channel] },
          { label: labels.fauReferenceNumber, value: report.submission.fauReferenceNumber },
          {
            label: labels.submittedAt,
            value: `${formatDateTime(report.submission.submittedAt, locale)} · ${report.submission.submittedBy.name}`,
          },
        ];
  return (
    <SectionCard title={labels.sections.reference}>
      <KeyValueList
        items={[
          { label: labels.referenceNumber, value: report.referenceNumber },
          { label: labels.author, value: report.author.name },
          { label: labels.approvedBy, value: report.approvedBy?.name ?? "–" },
          ...submissionItems,
        ]}
      />
    </SectionCard>
  );
}

function InstitutionSection({ report }: { report: FauReport }) {
  const { t } = useI18n();
  const labels = t.fauReports;
  const institution = report.reportingInstitution;
  return (
    <SectionCard title={labels.sections.institution}>
      <KeyValueList
        items={[
          { label: labels.institutionName, value: institution.name },
          { label: labels.companyId, value: institution.companyId },
          { label: labels.address, value: institution.address },
          { label: labels.obligedEntityType, value: institution.obligedEntityType },
        ]}
      />
      <p className={styles.hint}>{labels.institutionHint}</p>
    </SectionCard>
  );
}

/** Identification data never enters the system, so the fields are always empty and disabled (issue #20). */
function KycFields() {
  const { t } = useI18n();
  const labels = t.fauReports;
  const idPrefix = useId();
  return (
    <div className={styles.kycFields}>
      <p className={styles.kycHint}>
        <Badge tone="warning">{labels.kycMarker}</Badge> {labels.kycHint}
      </p>
      {KYC_FIELDS.map((field) => (
        <Field key={field} label={labels.kycFields[field]} htmlFor={`${idPrefix}-${field}`}>
          <input
            id={`${idPrefix}-${field}`}
            className={fieldStyles.input}
            value=""
            placeholder={labels.kycMarker}
            disabled
            readOnly
          />
        </Field>
      ))}
    </div>
  );
}

function SubjectFacts({ report }: { report: FauReport }) {
  const { t } = useI18n();
  const labels = t.fauReports;
  const { subject } = report;
  return (
    <KeyValueList
      items={[
        { label: labels.clientId, value: subject.clientId },
        { label: labels.country, value: subject.country || "–" },
        { label: labels.riskProfile, value: t.riskProfile[subject.riskProfile] },
        { label: labels.pep, value: subject.isPep ? t.common.yes : t.common.no },
      ]}
    />
  );
}

/** Read-only sections III to VI, for every state after draft and for roles that may not edit. */
function ReadOnlyContent({ report }: { report: FauReport }) {
  const { t } = useI18n();
  const labels = t.fauReports;
  return (
    <>
      <SectionCard title={labels.sections.subject}>
        <SubjectFacts report={report} />
        <KeyValueList
          items={[
            {
              label: labels.subjectTypeLabel,
              value:
                report.subject.subjectType === null
                  ? labels.subjectTypeNotSet
                  : labels.subjectType[report.subject.subjectType],
            },
          ]}
        />
        <KycFields />
      </SectionCard>
      <SectionCard title={labels.sections.type}>
        <p>{labels.reportType[report.reportType]}</p>
      </SectionCard>
      <SectionCard title={labels.sections.description}>
        <p className={styles.preformatted}>{report.description}</p>
      </SectionCard>
      <SectionCard title={labels.sections.execution}>
        <KeyValueList
          items={[
            { label: labels.executionStatusLabel, value: labels.executionStatus[report.execution.status] },
          ]}
        />
        {report.execution.note && <p className={styles.preformatted}>{report.execution.note}</p>}
      </SectionCard>
      <p className={styles.hint}>{labels.readOnlyHint}</p>
    </>
  );
}

function DraftForm({ report }: { report: FauReport }) {
  const { t } = useI18n();
  const labels = t.fauReports;
  const saveMutation = useSaveFauReportDraft();
  const [changes, setChanges] = useState(() => toDraftChanges(report));
  const [isDescriptionMissing, setIsDescriptionMissing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const idPrefix = useId();
  const fieldId = (name: string) => `${idPrefix}-${name}`;

  const updateChanges = (update: Partial<FauReportDraftChanges>) => {
    setIsSaved(false);
    setChanges((current) => ({ ...current, ...update }));
  };

  const save = (submit: boolean) => {
    if (submit && changes.description.trim() === "") {
      setIsDescriptionMissing(true);
      return;
    }
    setIsDescriptionMissing(false);
    saveMutation.mutate({ reportId: report.id, changes, submit }, { onSuccess: () => setIsSaved(!submit) });
  };

  return (
    <form
      className={styles.sections}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
    >
      <SectionCard title={labels.sections.subject}>
        <SubjectFacts report={report} />
        <Field label={labels.subjectTypeLabel} htmlFor={fieldId("subjectType")}>
          <select
            id={fieldId("subjectType")}
            className={fieldStyles.select}
            value={changes.subjectType ?? NO_SUBJECT_TYPE}
            onChange={(event) => {
              const parsed = fauSubjectTypeSchema.safeParse(event.target.value);
              updateChanges({ subjectType: parsed.success ? parsed.data : null });
            }}
          >
            <option value={NO_SUBJECT_TYPE}>{labels.subjectTypeNotSet}</option>
            {FAU_SUBJECT_TYPES.map((subjectType) => (
              <option key={subjectType} value={subjectType}>
                {labels.subjectType[subjectType]}
              </option>
            ))}
          </select>
        </Field>
        <KycFields />
      </SectionCard>

      <SectionCard title={labels.sections.type}>
        <Field label={labels.sections.type} htmlFor={fieldId("reportType")}>
          <select
            id={fieldId("reportType")}
            className={fieldStyles.select}
            value={changes.reportType}
            onChange={(event) => updateChanges({ reportType: fauReportTypeSchema.parse(event.target.value) })}
          >
            {FAU_REPORT_TYPES.map((reportType) => (
              <option key={reportType} value={reportType}>
                {labels.reportType[reportType]}
              </option>
            ))}
          </select>
        </Field>
      </SectionCard>

      <SectionCard title={labels.sections.description}>
        <Notice tone="ai" title={labels.descriptionDraftNotice}>
          {labels.descriptionHint}
        </Notice>
        <Field
          label={labels.sections.description}
          htmlFor={fieldId("description")}
          error={isDescriptionMissing ? labels.descriptionRequired : null}
        >
          <textarea
            id={fieldId("description")}
            className={`${fieldStyles.textarea} ${styles.descriptionInput}`}
            value={changes.description}
            onChange={(event) => updateChanges({ description: event.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard title={labels.sections.execution}>
        <Field label={labels.executionStatusLabel} htmlFor={fieldId("executionStatus")}>
          <select
            id={fieldId("executionStatus")}
            className={fieldStyles.select}
            value={changes.execution.status}
            onChange={(event) =>
              updateChanges({
                execution: {
                  ...changes.execution,
                  status: fauExecutionStatusSchema.parse(event.target.value),
                },
              })
            }
          >
            {FAU_EXECUTION_STATUSES.map((executionStatus) => (
              <option key={executionStatus} value={executionStatus}>
                {labels.executionStatus[executionStatus]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={labels.executionNote} htmlFor={fieldId("executionNote")}>
          <textarea
            id={fieldId("executionNote")}
            className={fieldStyles.textarea}
            value={changes.execution.note}
            onChange={(event) =>
              updateChanges({ execution: { ...changes.execution, note: event.target.value } })
            }
          />
        </Field>
      </SectionCard>

      {saveMutation.error && <ErrorState error={saveMutation.error} />}
      <div className={styles.buttons}>
        <Button
          type="submit"
          variant="secondary"
          icon={<Save aria-hidden="true" />}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? labels.saving : labels.saveDraft}
        </Button>
        <Button
          icon={<Send aria-hidden="true" />}
          disabled={saveMutation.isPending}
          onClick={() => save(true)}
        >
          {saveMutation.isPending ? labels.submitting : labels.saveAndSubmit}
        </Button>
        {isSaved && (
          <span className={styles.successNote} role="status">
            {labels.saved}
          </span>
        )}
      </div>
    </form>
  );
}

/** MP FAÚ č. 4 sections I to VI; III to VI are a form when editable (a draft, and the role may prepare it). */
export function FauReportSections({ report, isEditable }: { report: FauReport; isEditable: boolean }) {
  return (
    <div className={styles.sections}>
      <ReferenceSection report={report} />
      <InstitutionSection report={report} />
      {isEditable ? <DraftForm report={report} /> : <ReadOnlyContent report={report} />}
    </div>
  );
}
