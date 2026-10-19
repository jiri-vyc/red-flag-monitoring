"use client";

import { Scale, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fieldStyles } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { formatLegalBasisRefs } from "@/features/regulations/types";
import { useI18n } from "@/i18n/I18nProvider";

import type { PolicyDraftResult } from "../types";
import styles from "./Wizard.module.css";

type PolicyDraftStepProps = { draft: PolicyDraftResult; onGenerateRules: (policyText: string) => void };

export function PolicyDraftStep({ draft, onGenerateRules }: PolicyDraftStepProps) {
  const { t } = useI18n();
  const [policyText, setPolicyText] = useState(draft.policy.text);
  return (
    <Card tone="ai" title={t.wizard.policyDraftTitle}>
      <div className={styles.provenance}>
        <Badge tone="primary" icon={<Scale aria-hidden="true" />}>
          {draft.regulation.shortName}
        </Badge>
        <Badge tone="ai">
          {t.common.legalBasis}: {formatLegalBasisRefs(draft.policy.legalBases)}
        </Badge>
      </div>
      <h3>{draft.policy.name}</h3>
      <p className={styles.muted}>{t.wizard.policyDraftHint}</p>
      <label htmlFor="wizard-policy-text" className="visually-hidden">
        {t.policies.text}
      </label>
      <textarea
        id="wizard-policy-text"
        className={`${fieldStyles.textarea} ${styles.policyText}`}
        value={policyText}
        onChange={(event) => setPolicyText(event.target.value)}
      />
      <Notice tone="ai" title={t.aiNotice.title}>
        {t.aiNotice.body}
      </Notice>
      <div>
        <Button size="lg" icon={<Sparkles aria-hidden="true" />} onClick={() => onGenerateRules(policyText)}>
          {t.wizard.generateRules}
        </Button>
      </div>
    </Card>
  );
}
