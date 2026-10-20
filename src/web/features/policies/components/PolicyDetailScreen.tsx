"use client";

import { FileText, ListChecks, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { EmptyState, ErrorState, QueryView } from "@/components/ui/StateViews";
import {
  useDraftingJob,
  useRefreshDraftedArtifacts,
  useRetryDraftingJob,
} from "@/features/draftingJobs/api/hooks";
import { DraftingJobStatusBadge } from "@/features/draftingJobs/components/DraftingJobStatusBadge";
import { DraftingJobWarnings } from "@/features/draftingJobs/components/DraftingJobWarnings";
import type { DraftingJob } from "@/features/draftingJobs/types";
import { LegalBasisList } from "@/features/regulations/components/LegalBasisList";
import { useRules } from "@/features/rules/api/hooks";
import { RuleStatusBadge, RuleTypeBadge } from "@/features/rules/components/RuleBadges";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { assertUnreachable } from "@/lib/assertUnreachable";
import { formatDateTime } from "@/lib/format";
import { useRolePermissions } from "@/features/users/api/hooks";
import { RoleGateNotice } from "@/features/users/components/RoleGateNotice";

import { usePolicy } from "../api/hooks";
import type { Policy, PolicyVersion } from "../types";
import { PolicyOriginBadge, PolicyStatusBadge } from "./PolicyBadges";
import styles from "./PolicyDetailScreen.module.css";
import { PolicyTextEditor } from "./PolicyTextEditor";
import { PolicyVersionHistory } from "./PolicyVersionHistory";

function RelatedRules({ policy }: { policy: Policy }) {
  const { t } = useI18n();
  const rulesQuery = useRules();
  return (
    <Card
      title={
        <>
          <ListChecks aria-hidden="true" />
          {t.policies.relatedRules}
        </>
      }
    >
      <QueryView query={rulesQuery}>
        {(rules) => {
          const relatedRules = rules.filter((rule) => rule.policyId === policy.id);
          if (relatedRules.length === 0) {
            return <EmptyState message={t.policies.noRules} />;
          }
          return (
            <ul className={styles.ruleList}>
              {relatedRules.map((rule) => (
                <li key={rule.id}>
                  <Link href={`/rules/${rule.id}`}>{rule.name}</Link>
                  <span className={styles.badges}>
                    <RuleTypeBadge type={rule.type} />
                    <RuleStatusBadge status={rule.status} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }}
      </QueryView>
    </Card>
  );
}

function RulesJobStatus({ job }: { job: DraftingJob }) {
  const { t } = useI18n();
  switch (job.status) {
    case "pending":
    case "running":
      return <>{t.policies.rulesJobRunning}</>;
    case "succeeded":
      return (
        <>
          {formatMessage(t.policies.rulesJobSucceeded, { count: job.ruleIds.length })}{" "}
          <Link href="/rules">{t.policies.reviewDraftedRules}</Link>
        </>
      );
    case "failed":
      return (
        <>
          {t.policies.rulesJobFailed} {job.errorMessage ?? t.draftingJobs.noErrorMessage}
        </>
      );
    default:
      return assertUnreachable(job.status);
  }
}

function RulesJobNotice({ jobId, onRetried }: { jobId: string; onRetried: (jobId: string) => void }) {
  const { canDraftRules } = useRolePermissions();
  const { t } = useI18n();
  const jobQuery = useDraftingJob(jobId);
  const retryMutation = useRetryDraftingJob();
  const job = jobQuery.data;
  useRefreshDraftedArtifacts(job);
  return (
    <div className={styles.rulesJob}>
      <Notice tone="ai" title={t.policies.approved}>
        {job ? <RulesJobStatus job={job} /> : t.common.loading}
      </Notice>
      <div className={styles.rulesJobActions}>
        {job && <DraftingJobStatusBadge status={job.status} />}
        {job?.status === "failed" && canDraftRules && (
          <Button
            variant="secondary"
            icon={<RotateCcw aria-hidden="true" />}
            disabled={retryMutation.isPending}
            onClick={() =>
              retryMutation.mutate(job.id, { onSuccess: (retriedJob) => onRetried(retriedJob.id) })
            }
          >
            {retryMutation.isPending ? t.draftingJobs.retrying : t.draftingJobs.retry}
          </Button>
        )}
        <RefreshButton
          label={t.draftingJobs.refresh}
          isFetching={jobQuery.isFetching}
          onRefresh={() => void jobQuery.refetch()}
        />
      </div>
      {job && <DraftingJobWarnings jobs={[job]} />}
      {(jobQuery.error || retryMutation.error) && (
        <ErrorState error={jobQuery.error ?? retryMutation.error} />
      )}
    </div>
  );
}

/** The current text: editable while the policy is a draft. */
function CurrentPolicyText({
  policy,
  onApproved,
}: {
  policy: Policy;
  onApproved: (jobId: string | null) => void;
}) {
  const { canApprovePolicy } = useRolePermissions();
  const { t } = useI18n();
  if (policy.status !== "draft") {
    return <MarkdownText>{policy.text}</MarkdownText>;
  }
  return (
    <>
      <Notice tone="info">{t.policies.editDraftHint}</Notice>
      <PolicyTextEditor
        key={policy.updatedAt}
        policy={policy}
        showApprove={canApprovePolicy}
        onApproved={({ rulesJob }) => onApproved(rulesJob?.id ?? null)}
      />
      {!canApprovePolicy && <RoleGateNotice requiredRole="compliance_officer" />}
    </>
  );
}

function OlderPolicyText({
  version,
  latestVersionNumber,
}: {
  version: PolicyVersion;
  latestVersionNumber: number;
}) {
  const { t } = useI18n();
  return (
    <>
      <Notice tone="info">
        {formatMessage(t.policies.olderVersionNote, { versionNumber: latestVersionNumber })}
      </Notice>
      <MarkdownText>{version.text}</MarkdownText>
    </>
  );
}

function PolicyDetail({ policy }: { policy: Policy }) {
  const { t, locale } = useI18n();
  const [rulesJobId, setRulesJobId] = useState<string | null>(null);
  // Null shows the latest version, so a new version saved from the editor is shown right away.
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const latestVersion = policy.versions.at(-1);
  const selectedOlderVersion = policy.versions.find(
    (version) => version !== latestVersion && version.versionNumber === selectedVersionNumber,
  );
  const shownVersionNumber = selectedOlderVersion?.versionNumber ?? latestVersion?.versionNumber;
  return (
    <>
      <PageHeader
        backLink={{ href: "/policies", label: t.policies.title }}
        title={policy.name}
        meta={
          <>
            <PolicyStatusBadge status={policy.status} />
            <PolicyOriginBadge origin={policy.origin} />
          </>
        }
      />
      {rulesJobId && <RulesJobNotice jobId={rulesJobId} onRetried={setRulesJobId} />}
      <Card tone={policy.origin === "generated" ? "ai" : "default"}>
        <KeyValueList
          items={[
            {
              label: t.common.legalBasis,
              value: <LegalBasisList legalBases={policy.legalBases} emptyLabel={t.policies.internalPolicy} />,
            },
            { label: t.common.updated, value: formatDateTime(policy.updatedAt, locale) },
            {
              label: t.policies.approvedBy,
              value:
                policy.approvedBy && policy.approvedAt
                  ? `${policy.approvedBy}, ${formatDateTime(policy.approvedAt, locale)}`
                  : "–",
            },
          ]}
        />
        {policy.origin === "generated" && (
          <Notice tone="ai" title={t.aiNotice.title}>
            {t.aiNotice.body}
          </Notice>
        )}
      </Card>
      <Card
        title={
          <>
            <FileText aria-hidden="true" />
            {shownVersionNumber === undefined
              ? t.policies.text
              : `${t.policies.text} (v${shownVersionNumber})`}
          </>
        }
      >
        {selectedOlderVersion && latestVersion && (
          <OlderPolicyText version={selectedOlderVersion} latestVersionNumber={latestVersion.versionNumber} />
        )}
        {/* Hidden, not unmounted, so unsaved edits of the draft survive viewing an older version. */}
        <div className={styles.currentText} hidden={selectedOlderVersion !== undefined}>
          <CurrentPolicyText policy={policy} onApproved={setRulesJobId} />
        </div>
      </Card>
      {latestVersion && (
        <PolicyVersionHistory
          versions={policy.versions}
          selectedVersionNumber={selectedOlderVersion?.versionNumber ?? latestVersion.versionNumber}
          onSelectVersion={(versionNumber) =>
            setSelectedVersionNumber(versionNumber === latestVersion.versionNumber ? null : versionNumber)
          }
        />
      )}
      <RelatedRules policy={policy} />
    </>
  );
}

export function PolicyDetailScreen({ policyId }: { policyId: string }) {
  const policyQuery = usePolicy(policyId);
  return <QueryView query={policyQuery}>{(policy) => <PolicyDetail policy={policy} />}</QueryView>;
}
