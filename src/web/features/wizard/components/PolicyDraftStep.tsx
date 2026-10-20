"use client";

import { CircleCheck, Scale, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fieldStyles } from "@/components/ui/Field";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { Notice } from "@/components/ui/Notice";
import { PolicyTextField } from "@/features/policies/components/PolicyTextField";
import type { Policy } from "@/features/policies/types";
import { formatLegalBasisRefs } from "@/features/regulations/types";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { useRolePermissions } from "@/features/users/api/hooks";
import { RoleGateNotice } from "@/features/users/components/RoleGateNotice";

import { canContinueToRules } from "../policySelection";
import type { PolicyDraftResult } from "../types";
import styles from "./Wizard.module.css";

export type PolicyDraftSelection = {
  /** Edited texts by policy id. */
  policyTexts: Record<string, string>;
  /** Drafts the user unchecked: they are not approved and stay drafts. */
  skippedPolicyIds: string[];
};

type PolicyDraftStepProps = {
  draft: PolicyDraftResult;
  /** Texts and skipped drafts from before a failed attempt. */
  initialSelection: PolicyDraftSelection;
  /** Policies approved in an earlier attempt are shown read-only and not approved again. */
  approvedPolicyIds: string[];
  onApprove: (selection: PolicyDraftSelection) => void;
};

function PolicyDraftCard({
  policy,
  regulationShortName,
  text,
  isApproved,
  isSkipped,
  onTextChange,
  onSkippedChange,
}: {
  policy: Policy;
  regulationShortName: string;
  text: string;
  isApproved: boolean;
  isSkipped: boolean;
  onTextChange: (text: string) => void;
  onSkippedChange: (isSkipped: boolean) => void;
}) {
  const { t } = useI18n();
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
      </div>
      <h3>{policy.name}</h3>
      {isApproved ? (
        <MarkdownText>{text}</MarkdownText>
      ) : (
        <>
          <div>
            <label className={fieldStyles.checkboxOption}>
              <input
                type="checkbox"
                checked={!isSkipped}
                onChange={(event) => onSkippedChange(!event.target.checked)}
              />
              {t.wizard.includePolicy}
              <span className="visually-hidden">: {policy.name}</span>
            </label>
          </div>
          {/* A skipped draft is not saved, so it is read-only; its edits come back when it is checked again. */}
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
      )}
    </article>
  );
}

export function PolicyDraftStep({
  draft,
  initialSelection,
  approvedPolicyIds,
  onApprove,
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
            onTextChange={(text) => setPolicyTexts((current) => ({ ...current, [policy.id]: text }))}
            onSkippedChange={(isSkipped) => setSkipped(policy.id, isSkipped)}
          />
        ))}
      </div>
      {canApprovePolicy ? (
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
      ) : (
        <RoleGateNotice permission="canApprovePolicy" />
      )}
    </Card>
  );
}
