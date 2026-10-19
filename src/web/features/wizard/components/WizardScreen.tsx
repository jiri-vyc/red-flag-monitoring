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
import { useRegulation } from "@/features/regulations/api/hooks";
import type { Rule } from "@/features/rules/types";
import { useI18n } from "@/i18n/I18nProvider";

import {
  useFinishRuleReview,
  useGeneratePolicyDraft,
  useGenerateRules,
  useWizardCapabilities,
} from "../api/hooks";
import type { GeneratePolicyInput, PolicyDraftResult } from "../types";
import { AiProgress } from "./AiProgress";
import { PolicyDraftStep } from "./PolicyDraftStep";
import { RuleReviewStep } from "./RuleReviewStep";
import { SourceStep } from "./SourceStep";
import styles from "./Wizard.module.css";
import { WizardStepper, type WizardStep } from "./WizardStepper";

type WizardState =
  | { step: "source" }
  | { step: "policy"; draft: PolicyDraftResult }
  | { step: "review"; draft: PolicyDraftResult; rules: Rule[] }
  | { step: "done"; draft: PolicyDraftResult; rules: Rule[] };

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
            href={`/policies/${draft.policy.id}`}
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

function findStepperStep(state: WizardState, isGeneratingRules: boolean): WizardStep {
  if (state.step === "policy" && isGeneratingRules) {
    return "rules";
  }
  return state.step;
}

function WizardFlow({ initialValues }: { initialValues: { url?: string; regulationName?: string } }) {
  const { t } = useI18n();
  const [state, setState] = useState<WizardState>({ step: "source" });
  const generatePolicyMutation = useGeneratePolicyDraft();
  const updatePolicyMutation = useUpdatePolicyText();
  const generateRulesMutation = useGenerateRules();
  const finishReviewMutation = useFinishRuleReview();
  const isGeneratingRules = updatePolicyMutation.isPending || generateRulesMutation.isPending;

  const generatePolicy = (input: GeneratePolicyInput) =>
    generatePolicyMutation.mutate(input, { onSuccess: (draft) => setState({ step: "policy", draft }) });

  const generateRules = async (draft: PolicyDraftResult, policyText: string) => {
    if (policyText !== draft.policy.text) {
      await updatePolicyMutation.mutateAsync({ policyId: draft.policy.id, text: policyText });
    }
    const rules = await generateRulesMutation.mutateAsync(draft.policy.id);
    setState({ step: "review", draft, rules });
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
    finishReviewMutation.mutate(draft.policy.id, {
      onSuccess: (rules) => setState({ step: "done", draft, rules }),
    });

  const restart = () => {
    generatePolicyMutation.reset();
    generateRulesMutation.reset();
    finishReviewMutation.reset();
    setState({ step: "source" });
  };

  const stepError =
    generatePolicyMutation.error ??
    updatePolicyMutation.error ??
    generateRulesMutation.error ??
    finishReviewMutation.error;

  return (
    <>
      <WizardStepper currentStep={findStepperStep(state, isGeneratingRules)} />
      {stepError && <ErrorState error={stepError} />}

      {state.step === "source" &&
        (generatePolicyMutation.isPending ? (
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
            initialValues={{ ...initialValues, kind: initialValues.url ? "url" : "file" }}
            onSubmit={generatePolicy}
          />
        ))}

      {state.step === "policy" &&
        (isGeneratingRules ? (
          <AiProgress
            title={t.wizard.rulesProgressTitle}
            stepLabels={[
              t.wizard.rulesProgress.analysing,
              t.wizard.rulesProgress.deterministic,
              t.wizard.rulesProgress.agentic,
              t.wizard.rulesProgress.validating,
            ]}
          />
        ) : (
          <PolicyDraftStep
            draft={state.draft}
            // The failure is rendered from the mutation error state above, so the rejected promise needs no handler.
            onGenerateRules={(policyText) =>
              void generateRules(state.draft, policyText).catch(() => undefined)
            }
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
  // A missing regulation only means there is nothing to prefill; the wizard still works.
  const regulation = regulationQuery.data;
  return (
    <WizardFlow
      initialValues={{ url: regulation?.sourceUrl ?? "", regulationName: regulation?.name ?? "" }}
    />
  );
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
    <WizardFlow initialValues={{}} />
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
