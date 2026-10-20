"use client";

import { Circle, CircleCheck, CircleX, FileText, RotateCcw, Scale, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { Notice } from "@/components/ui/Notice";
import { PolicyRejectedBadge } from "@/features/policies/components/PolicyBadges";
import { PolicyTextField } from "@/features/policies/components/PolicyTextField";
import { RejectPolicyPanel } from "@/features/policies/components/RejectPolicyPanel";
import { findRejectedLatestVersion } from "@/features/policies/domain/policyRejection";
import type { Policy } from "@/features/policies/types";
import { formatLegalBasisRefs } from "@/features/regulations/types";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { useRolePermissions } from "@/features/users/api/hooks";
import { RoleGateNotice } from "@/features/users/components/RoleGateNotice";

import { canContinueToRules, isEveryDraftRejected } from "../policySelection";
import type { PolicyDraftResult } from "../types";
import styles from "./Wizard.module.css";

export type PolicyDraftSelection = {
  /** Edited texts by policy id. */
  policyTexts: Record<string, string>;
  /** Drafts the user deselected: they are not approved and stay drafts. */
  skippedPolicyIds: string[];
};

type PolicyDraftStepProps = {
  draft: PolicyDraftResult;
  /** Texts and skipped drafts from before a failed attempt. */
  initialSelection: PolicyDraftSelection;
  /** Policies approved in an earlier attempt are shown read-only and not approved again. */
  approvedPolicyIds: string[];
  onApprove: (selection: PolicyDraftSelection) => void;
  /** A rejected draft is decided: shown read-only with the reason, never selected or approved. */
  onPolicyRejected: (policy: Policy) => void;
};

/** The reviewer's reason, stored as the rejected version's review comment. */
function RejectionReason({ reason }: { reason: string | null }) {
  const { t } = useI18n();
  return (
    <p className={styles.muted}>
      {t.policies.rejectReason}: <strong>{reason ?? "–"}</strong>
    </p>
  );
}

function PolicyDraftEditor({
  policy,
  text,
  isSkipped,
  canReject,
  onTextChange,
  onSkippedChange,
  onRejected,
}: {
  policy: Policy;
  text: string;
  isSkipped: boolean;
  canReject: boolean;
  onTextChange: (text: string) => void;
  onSkippedChange: (isSkipped: boolean) => void;
  onRejected: (policy: Policy) => void;
}) {
  const { t } = useI18n();
  const [isRejecting, setIsRejecting] = useState(false);
  return (
    <>
      <div className={styles.generatedRuleActions}>
        {/* A toggle, not an immediate approval: it selects the draft for the bulk approval below. */}
        <Button
          variant={isSkipped ? "secondary" : "success"}
          icon={isSkipped ? <Circle aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
          aria-pressed={!isSkipped}
          onClick={() => onSkippedChange(!isSkipped)}
        >
          {t.wizard.includePolicy}
          <span className="visually-hidden">: {policy.name}</span>
        </Button>
        {canReject && !isRejecting && (
          <Button variant="danger" icon={<CircleX aria-hidden="true" />} onClick={() => setIsRejecting(true)}>
            {t.wizard.rejectPolicy}
            <span className="visually-hidden">: {policy.name}</span>
          </Button>
        )}
      </div>
      {/* The stored draft is rejected, not unsaved wizard edits; the rejected card then shows that wording. */}
      {isRejecting && (
        <RejectPolicyPanel
          policyId={policy.id}
          onRejected={(rejectedPolicy) => {
            setIsRejecting(false);
            onRejected(rejectedPolicy);
          }}
          onCancel={() => setIsRejecting(false)}
        />
      )}
      {/* A skipped draft is not saved, so it is read-only; its edits come back when it is selected again. */}
      {isSkipped ? (
        <MarkdownText>{text}</MarkdownText>
      ) : (
        <PolicyTextField
          id={`wizard-policy-text-${policy.id}`}
          value={text}
          onChange={onTextChange}
          textAreaClassName={styles.policyText}
        />
      )}
    </>
  );
}

function PolicyDraftCardBody({
  policy,
  text,
  isApproved,
  isSkipped,
  canReject,
  onTextChange,
  onSkippedChange,
  onRejected,
}: {
  policy: Policy;
  text: string;
  isApproved: boolean;
  isSkipped: boolean;
  canReject: boolean;
  onTextChange: (text: string) => void;
  onSkippedChange: (isSkipped: boolean) => void;
  onRejected: (policy: Policy) => void;
}) {
  const rejectedVersion = findRejectedLatestVersion(policy);
  if (isApproved) {
    return <MarkdownText>{text}</MarkdownText>;
  }
  if (rejectedVersion) {
    return (
      <>
        <RejectionReason reason={rejectedVersion.reviewComment} />
        <MarkdownText>{rejectedVersion.text}</MarkdownText>
      </>
    );
  }
  return (
    <PolicyDraftEditor
      policy={policy}
      text={text}
      isSkipped={isSkipped}
      canReject={canReject}
      onTextChange={onTextChange}
      onSkippedChange={onSkippedChange}
      onRejected={onRejected}
    />
  );
}

/** Every draft was rejected: nothing to generate rules from, so the run ends here. */
function AllDraftsRejectedNotice() {
  const { t } = useI18n();
  return (
    <Notice
      tone="info"
      title={t.wizard.allPoliciesRejectedTitle}
      actions={
        <>
          <ButtonLink href="/policies" variant="secondary" icon={<FileText aria-hidden="true" />}>
            {t.wizard.goToPolicies}
          </ButtonLink>
          <ButtonLink href="/wizard" variant="ghost" icon={<RotateCcw aria-hidden="true" />}>
            {t.wizard.startAgain}
          </ButtonLink>
        </>
      }
    >
      {t.wizard.allPoliciesRejected}
    </Notice>
  );
}

function PolicyDraftCard({
  policy,
  regulationShortName,
  text,
  isApproved,
  isSkipped,
  canReject,
  onTextChange,
  onSkippedChange,
  onRejected,
}: {
  policy: Policy;
  regulationShortName: string;
  text: string;
  isApproved: boolean;
  isSkipped: boolean;
  canReject: boolean;
  onTextChange: (text: string) => void;
  onSkippedChange: (isSkipped: boolean) => void;
  onRejected: (policy: Policy) => void;
}) {
  const { t } = useI18n();
  const isRejected = !isApproved && findRejectedLatestVersion(policy) !== undefined;
  return (
    <article className={styles.generatedRule}>
      <div className={styles.provenance}>
        <Badge tone="primary" icon={<Scale aria-hidden="true" />}>
          {regulationShortName}
        </Badge>
        <Badge tone="ai">
          {t.common.legalBasis}: {formatLegalBasisRefs(policy.legalBases)}
        </Badge>
        {isApproved && (
          <Badge tone="success" icon={<CircleCheck aria-hidden="true" />}>
            {t.policies.approved}
          </Badge>
        )}
        {isRejected && <PolicyRejectedBadge />}
      </div>
      <h3>{policy.name}</h3>
      <PolicyDraftCardBody
        policy={policy}
        text={text}
        isApproved={isApproved}
        isSkipped={isSkipped}
        canReject={canReject}
        onTextChange={onTextChange}
        onSkippedChange={onSkippedChange}
        onRejected={onRejected}
      />
    </article>
  );
}

export function PolicyDraftStep({
  draft,
  initialSelection,
  approvedPolicyIds,
  onApprove,
  onPolicyRejected,
}: PolicyDraftStepProps) {
  const { t } = useI18n();
  const { canApprovePolicy } = useRolePermissions();
  const [policyTexts, setPolicyTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      draft.policies.map((policy) => [policy.id, initialSelection.policyTexts[policy.id] ?? policy.text]),
    ),
  );
  const [skippedPolicyIds, setSkippedPolicyIds] = useState(initialSelection.skippedPolicyIds);
  const canContinue = canContinueToRules(draft.policies, approvedPolicyIds, skippedPolicyIds);
  const areAllDraftsRejected = isEveryDraftRejected(draft.policies, approvedPolicyIds);
  const setSkipped = (policyId: string, isSkipped: boolean) =>
    setSkippedPolicyIds((current) =>
      isSkipped ? [...current, policyId] : current.filter((skippedId) => skippedId !== policyId),
    );
  return (
    <Card tone="ai" title={t.wizard.policyDraftTitle}>
      <p className={styles.muted}>
        {formatMessage(t.wizard.policyDraftHint, { count: draft.policies.length })}
      </p>
      <Notice tone="ai" title={t.aiNotice.title}>
        {t.aiNotice.body}
      </Notice>
      <div className={styles.generatedRules}>
        {draft.policies.map((policy) => (
          <PolicyDraftCard
            key={policy.id}
            policy={policy}
            regulationShortName={draft.regulation.shortName}
            text={policyTexts[policy.id] ?? policy.text}
            isApproved={approvedPolicyIds.includes(policy.id)}
            isSkipped={skippedPolicyIds.includes(policy.id)}
            canReject={canApprovePolicy}
            onTextChange={(text) => setPolicyTexts((current) => ({ ...current, [policy.id]: text }))}
            onSkippedChange={(isSkipped) => setSkipped(policy.id, isSkipped)}
            onRejected={onPolicyRejected}
          />
        ))}
      </div>
      {areAllDraftsRejected && <AllDraftsRejectedNotice />}
      {!areAllDraftsRejected && canApprovePolicy && (
        <>
          <p className={styles.muted}>{t.wizard.skipPolicyHint}</p>
          <div>
            <Button
              size="lg"
              icon={<Sparkles aria-hidden="true" />}
              disabled={!canContinue}
              aria-describedby={canContinue ? undefined : "wizard-no-policy-selected"}
              onClick={() => onApprove({ policyTexts, skippedPolicyIds })}
            >
              {t.wizard.generateRules}
            </Button>
          </div>
          {!canContinue && (
            <p id="wizard-no-policy-selected" className={styles.muted}>
              {t.wizard.noPolicySelected}
            </p>
          )}
        </>
      )}
      {!canApprovePolicy && <RoleGateNotice permission="canApprovePolicy" />}
    </Card>
  );
}
