"use client";

import { CircleCheck, Scale, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fieldStyles } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import type { Policy } from "@/features/policies/types";
import { formatLegalBasisRefs } from "@/features/regulations/types";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { useRolePermissions } from "@/features/users/api/hooks";
import { RoleGateNotice } from "@/features/users/components/RoleGateNotice";

import type { PolicyDraftResult } from "../types";
import styles from "./Wizard.module.css";

type PolicyDraftStepProps = {
  draft: PolicyDraftResult;
  /** Texts edited before a failed attempt, by policy id. */
  initialPolicyTexts: Record<string, string>;
  /** Policies approved in an earlier attempt are shown read-only and not approved again. */
  approvedPolicyIds: string[];
  /** Edited texts by policy id. */
  onApprove: (policyTexts: Record<string, string>) => void;
};

function PolicyDraftCard({
  policy,
  regulationShortName,
  text,
  isApproved,
  onTextChange,
}: {
  policy: Policy;
  regulationShortName: string;
  text: string;
  isApproved: boolean;
  onTextChange: (text: string) => void;
}) {
  const { t } = useI18n();
  const editorId = `wizard-policy-text-${policy.id}`;
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
      <label htmlFor={editorId} className="visually-hidden">
        {t.policies.text}
      </label>
      <textarea
        id={editorId}
        className={`${fieldStyles.textarea} ${styles.policyText}`}
        value={text}
        readOnly={isApproved}
        onChange={(event) => onTextChange(event.target.value)}
      />
    </article>
  );
}

export function PolicyDraftStep({
  draft,
  initialPolicyTexts,
  approvedPolicyIds,
  onApprove,
}: PolicyDraftStepProps) {
  const { t } = useI18n();
  const { canApprovePolicy } = useRolePermissions();
  const [policyTexts, setPolicyTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      draft.policies.map((policy) => [policy.id, initialPolicyTexts[policy.id] ?? policy.text]),
    ),
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
            onTextChange={(text) => setPolicyTexts((current) => ({ ...current, [policy.id]: text }))}
          />
        ))}
      </div>
      {canApprovePolicy ? (
        <div>
          <Button size="lg" icon={<Sparkles aria-hidden="true" />} onClick={() => onApprove(policyTexts)}>
            {t.wizard.generateRules}
          </Button>
        </div>
      ) : (
        <RoleGateNotice permission="canApprovePolicy" />
      )}
    </Card>
  );
}
