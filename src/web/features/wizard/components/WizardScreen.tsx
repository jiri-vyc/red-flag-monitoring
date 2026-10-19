"use client";

import { CircleCheck, ListChecks, FileText, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingRing } from "@/components/ui/LoadingRing";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/StateViews";
import { useUpdatePolicyText } from "@/features/policies/api/hooks";
import type { Policy } from "@/features/policies/types";
import { useRegulation } from "@/features/regulations/api/hooks";
import type { Regulation } from "@/features/regulations/types";
import type { Rule } from "@/features/rules/types";
import { useI18n } from "@/i18n/I18nProvider";

import {
  useApprovePolicyDraft,
  useDraftPolicies,
  useFinishRuleReview,
  useWizardCapabilities,
} from "../api/hooks";
import type { ApprovedPolicyDraft, DraftPoliciesInput, PolicyDraftResult } from "../types";
import { AiProgress } from "./AiProgress";
import { PolicyDraftStep } from "./PolicyDraftStep";
import { RuleReviewStep } from "./RuleReviewStep";
import { SourceStep } from "./SourceStep";
import styles from "./Wizard.module.css";
import { WizardStepper, type WizardStep } from "./WizardStepper";

type WizardState =
  | { step: "source" }
  /** After a failure the step keeps the approved policies and the edited texts, so a retry continues. */
  | {
      step: "policy";
      draft: PolicyDraftResult;
      approvals: ApprovedPolicyDraft[];
      policyTexts: Record<string, string>;
    }
  | { step: "review"; draft: PolicyDraftResult; rules: Rule[] }
  | { step: "done"; draft: PolicyDraftResult; rules: Rule[] };

function findPolicyLink(policies: Policy[]): string {
  const [onlyPolicy, ...otherPolicies] = policies;
  return onlyPolicy && otherPolicies.length === 0 ? `/policies/${onlyPolicy.id}` : "/policies";
}

function DoneStep({
  draft,
  rules,
  onRestart,
}: {
  draft: PolicyDraftResult;
  rules: Rule[];
  onRestart: () => void;
}) {
  const { t } = useI18n();
  const countByStatus = (status: Rule["status"]) => rules.filter((rule) => rule.status === status).length;
  return (
    <Card>
      <div className={styles.done}>
        <span className={styles.doneIcon} aria-hidden="true">
          <CircleCheck />
        </span>
        <h2>{t.wizard.doneTitle}</h2>
        <p className={styles.muted}>{t.wizard.doneBody}</p>
        <p className={styles.doneSummary}>
          {t.ruleStatus.active}: <strong>{countByStatus("active")}</strong> ·{" "}
          {t.ruleStatus.pending_for_review}: <strong>{countByStatus("pending_for_review")}</strong> ·{" "}
          {t.wizard.decision.rejected}: <strong>{countByStatus("inactive")}</strong>
        </p>
        <div className={styles.doneActions}>
          <ButtonLink href="/rules" icon={<ListChecks aria-hidden="true" />}>
            {t.wizard.goToRules}
          </ButtonLink>
          <ButtonLink
            href={findPolicyLink(draft.policies)}
            variant="secondary"
            icon={<FileText aria-hidden="true" />}
          >
            {t.wizard.goToPolicy}
          </ButtonLink>
          <Button variant="ghost" icon={<RotateCcw aria-hidden="true" />} onClick={onRestart}>
            {t.wizard.startAgain}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function findStepperStep(state: WizardState, isApprovingPolicies: boolean): WizardStep {
  if (state.step === "policy" && isApprovingPolicies) {
    return "rules";
  }
  return state.step;
}

function replacePolicy(draft: PolicyDraftResult, updatedPolicy: Policy): PolicyDraftResult {
  return {
    ...draft,
    policies: draft.policies.map((policy) => (policy.id === updatedPolicy.id ? updatedPolicy : policy)),
  };
}

function WizardFlow({ existingRegulation }: { existingRegulation: Regulation | null }) {
  const { t } = useI18n();
  const capabilities = useWizardCapabilities();
  const [state, setState] = useState<WizardState>({ step: "source" });
  // Approval runs several requests in a row, so no single mutation is pending the whole time.
  const [isApprovingPolicies, setIsApprovingPolicies] = useState(false);
  const draftPoliciesMutation = useDraftPolicies();
  const updatePolicyMutation = useUpdatePolicyText();
  const approvePolicyDraftMutation = useApprovePolicyDraft();
  const finishReviewMutation = useFinishRuleReview();

  const draftPolicies = (input: DraftPoliciesInput) =>
    draftPoliciesMutation.mutate(input, {
      onSuccess: (draft) => setState({ step: "policy", draft, approvals: [], policyTexts: {} }),
    });

  // Saves edited texts as new policy versions, then approves each policy; the approval drafts its rules.
  const approvePolicies = async (
    initialDraft: PolicyDraftResult,
    initialApprovals: ApprovedPolicyDraft[],
    policyTexts: Record<string, string>,
  ) => {
    let draft = initialDraft;
    const approvals = [...initialApprovals];
    const isApproved = (policyId: string) => approvals.some((approval) => approval.policy.id === policyId);
    setIsApprovingPolicies(true);
    try {
      for (const policy of initialDraft.policies.filter((candidate) => !isApproved(candidate.id))) {
        const text = policyTexts[policy.id] ?? policy.text;
        if (text !== policy.text) {
          draft = replacePolicy(draft, await updatePolicyMutation.mutateAsync({ policyId: policy.id, text }));
        }
        approvals.push(await approvePolicyDraftMutation.mutateAsync(policy.id));
      }
      setState({ step: "review", draft, rules: approvals.flatMap((approval) => approval.rules) });
    } catch {
      // The failure is rendered from the mutation error state; the progress so far is kept for a retry.
      setState({ step: "policy", draft, approvals, policyTexts });
    } finally {
      setIsApprovingPolicies(false);
    }
  };

  const replaceReviewedRule = (updatedRule: Rule) =>
    setState((current) =>
      current.step === "review"
        ? {
            ...current,
            rules: current.rules.map((rule) => (rule.id === updatedRule.id ? updatedRule : rule)),
          }
        : current,
    );

  const finishReview = (draft: PolicyDraftResult) =>
    finishReviewMutation.mutate(
      draft.policies.map((policy) => policy.id),
      { onSuccess: (rules) => setState({ step: "done", draft, rules }) },
    );

  const restart = () => {
    draftPoliciesMutation.reset();
    updatePolicyMutation.reset();
    approvePolicyDraftMutation.reset();
    finishReviewMutation.reset();
    setState({ step: "source" });
  };

  const stepError =
    draftPoliciesMutation.error ??
    updatePolicyMutation.error ??
    approvePolicyDraftMutation.error ??
    finishReviewMutation.error;

  return (
    <>
      <WizardStepper currentStep={findStepperStep(state, isApprovingPolicies)} />
      {stepError && !isApprovingPolicies && <ErrorState error={stepError} />}

      {state.step === "source" &&
        (draftPoliciesMutation.isPending ? (
          <AiProgress
            title={t.wizard.policyProgressTitle}
            stepLabels={[
              t.wizard.policyProgress.reading,
              t.wizard.policyProgress.extracting,
              t.wizard.policyProgress.building,
              t.wizard.policyProgress.linking,
            ]}
          />
        ) : (
          <SourceStep
            existingRegulation={existingRegulation}
            capabilities={capabilities}
            onSubmit={draftPolicies}
          />
        ))}

      {state.step === "policy" &&
        (isApprovingPolicies ? (
          <AiProgress
            title={t.wizard.rulesProgressTitle}
            stepLabels={[
              t.wizard.rulesProgress.approving,
              t.wizard.rulesProgress.analysing,
              t.wizard.rulesProgress.deterministic,
              t.wizard.rulesProgress.agentic,
              t.wizard.rulesProgress.validating,
            ]}
          />
        ) : (
          <PolicyDraftStep
            draft={state.draft}
            initialPolicyTexts={state.policyTexts}
            approvedPolicyIds={state.approvals.map((approval) => approval.policy.id)}
            onApprove={(policyTexts) => void approvePolicies(state.draft, state.approvals, policyTexts)}
          />
        ))}

      {state.step === "review" && (
        <RuleReviewStep
          rules={state.rules}
          isFinishing={finishReviewMutation.isPending}
          onRuleChange={replaceReviewedRule}
          onFinish={() => finishReview(state.draft)}
        />
      )}

      {state.step === "done" && <DoneStep draft={state.draft} rules={state.rules} onRestart={restart} />}
    </>
  );
}

function WizardForRegulation({ regulationId }: { regulationId: string }) {
  const { t } = useI18n();
  const regulationQuery = useRegulation(regulationId);
  if (regulationQuery.isPending) {
    return <LoadingRing label={t.common.loading} />;
  }
  // A missing regulation only means the wizard creates a new one instead of adding a wording.
  return <WizardFlow existingRegulation={regulationQuery.data ?? null} />;
}

function WizardContent({ regulationId }: { regulationId: string | null }) {
  const { t } = useI18n();
  const { isAvailable } = useWizardCapabilities();
  if (!isAvailable) {
    return (
      <Notice tone="info" title={t.wizard.unavailableTitle}>
        {t.wizard.unavailableMessage}
      </Notice>
    );
  }
  return regulationId ? (
    <WizardForRegulation regulationId={regulationId} />
  ) : (
    <WizardFlow existingRegulation={null} />
  );
}

export function WizardScreen({ regulationId }: { regulationId: string | null }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        backLink={{ href: "/", label: t.nav.dashboard }}
        title={t.wizard.title}
        description={t.wizard.subtitle}
      />
      <WizardContent regulationId={regulationId} />
    </>
  );
}
