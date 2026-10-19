"use client";

import { CircleCheck, CircleX, Pencil } from "lucide-react";
import { useState } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { EmptyState, ErrorState } from "@/components/ui/StateViews";
import { useDraftingJobGroup } from "@/features/draftingJobs/api/hooks";
import { DraftingJobWarnings } from "@/features/draftingJobs/components/DraftingJobWarnings";
import { formatLegalBasisRefs } from "@/features/regulations/types";
import { useRulesCapabilities, useRuleTransition, useUpdateDraftContent } from "@/features/rules/api/hooks";
import { RejectRulePanel } from "@/features/rules/components/RejectRulePanel";
import { RuleTypeBadge } from "@/features/rules/components/RuleBadges";
import { RuleContentEditor } from "@/features/rules/components/RuleContentEditor";
import { RuleContentView } from "@/features/rules/components/RuleContentView";
import { findRuleLegalBases, getLatestVersion } from "@/features/rules/domain/ruleLifecycle";
import type { Rule } from "@/features/rules/types";
import { useI18n } from "@/i18n/I18nProvider";

import styles from "./Wizard.module.css";

type ReviewDecision = "approved" | "rejected" | "pending";

const DECISION_TONES: Record<ReviewDecision, BadgeTone> = {
  approved: "success",
  rejected: "danger",
  pending: "neutral",
};

function findReviewDecision(rule: Rule): ReviewDecision {
  if (rule.status === "active") {
    return "approved";
  }
  return rule.status === "inactive" ? "rejected" : "pending";
}

function GeneratedRuleCard({ rule, onRuleChange }: { rule: Rule; onRuleChange: (rule: Rule) => void }) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const { canEditDraftContent } = useRulesCapabilities();
  const transitionMutation = useRuleTransition();
  const updateDraftMutation = useUpdateDraftContent();
  const decision = findReviewDecision(rule);
  const isPending = decision === "pending";

  return (
    <article className={`${styles.generatedRule} rf-slide-up`}>
      <header className={styles.generatedRuleHeader}>
        <div className={styles.generatedRuleTitle}>
          <h3>{rule.name}</h3>
          <div className={styles.provenance}>
            <RuleTypeBadge type={rule.type} />
            <Badge tone="ai">
              {t.common.legalBasis}: {formatLegalBasisRefs(findRuleLegalBases(rule))}
            </Badge>
            <Badge tone={DECISION_TONES[decision]}>{t.wizard.decision[decision]}</Badge>
          </div>
        </div>
        {isPending && !isEditing && !isRejecting && (
          <div className={styles.generatedRuleActions}>
            <Button
              variant="success"
              icon={<CircleCheck aria-hidden="true" />}
              disabled={transitionMutation.isPending}
              onClick={() =>
                transitionMutation.mutate({ ruleId: rule.id, action: "approve" }, { onSuccess: onRuleChange })
              }
            >
              {t.rules.action.approve}
            </Button>
            <Button
              variant="danger"
              icon={<CircleX aria-hidden="true" />}
              disabled={transitionMutation.isPending}
              onClick={() => {
                transitionMutation.reset();
                setIsRejecting(true);
              }}
            >
              {t.rules.action.reject}
            </Button>
            {canEditDraftContent && (
              <Button
                variant="secondary"
                icon={<Pencil aria-hidden="true" />}
                onClick={() => setIsEditing(true)}
              >
                {t.common.edit}
              </Button>
            )}
          </div>
        )}
      </header>
      {isRejecting && (
        <RejectRulePanel
          ruleId={rule.id}
          onCancel={() => setIsRejecting(false)}
          onRejected={(rejectedRule) => {
            setIsRejecting(false);
            onRuleChange(rejectedRule);
          }}
        />
      )}
      {isEditing ? (
        <RuleContentEditor
          idPrefix={`wizard-${rule.id}`}
          initialContent={getLatestVersion(rule).content}
          submitLabel={t.common.save}
          isSubmitting={updateDraftMutation.isPending}
          onSubmit={(content) =>
            updateDraftMutation.mutate(
              { ruleId: rule.id, content },
              {
                onSuccess: (updatedRule) => {
                  onRuleChange(updatedRule);
                  setIsEditing(false);
                },
              },
            )
          }
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <RuleContentView content={getLatestVersion(rule).content} />
      )}
      {(transitionMutation.error || updateDraftMutation.error) && (
        <ErrorState error={transitionMutation.error ?? updateDraftMutation.error} />
      )}
    </article>
  );
}

type RuleReviewStepProps = {
  rules: Rule[];
  rulesJobIds: string[];
  isFinishing: boolean;
  onRuleChange: (rule: Rule) => void;
  onFinish: () => void;
};

export function RuleReviewStep({
  rules,
  rulesJobIds,
  isFinishing,
  onRuleChange,
  onFinish,
}: RuleReviewStepProps) {
  const { t } = useI18n();
  const { jobs: rulesJobs } = useDraftingJobGroup(rulesJobIds);
  return (
    <Card tone="ai" title={t.wizard.reviewTitle}>
      <p className={styles.muted}>{t.wizard.reviewHint}</p>
      <Notice tone="ai" title={t.aiNotice.title}>
        {t.aiNotice.body}
      </Notice>
      <DraftingJobWarnings jobs={rulesJobs} />
      {rules.length === 0 ? (
        <EmptyState message={t.wizard.noRuleDrafts} />
      ) : (
        <div className={styles.generatedRules}>
          {rules.map((rule) => (
            <GeneratedRuleCard key={rule.id} rule={rule} onRuleChange={onRuleChange} />
          ))}
        </div>
      )}
      <div>
        <Button size="lg" disabled={isFinishing} icon={<CircleCheck aria-hidden="true" />} onClick={onFinish}>
          {isFinishing ? t.wizard.finishing : t.wizard.finishReview}
        </Button>
      </div>
    </Card>
  );
}
