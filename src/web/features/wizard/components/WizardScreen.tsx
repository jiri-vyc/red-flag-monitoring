"use client";

import { CircleCheck, ListChecks, FileText, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingRing } from "@/components/ui/LoadingRing";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/StateViews";
import {
  useDraftingJob,
  useDraftingJobGroup,
  useRefreshDraftedArtifacts,
  useRetryDraftingJob,
} from "@/features/draftingJobs/api/hooks";
import { DraftingJobsPanel } from "@/features/draftingJobs/components/DraftingJobsPanel";
import { wizardRunHref } from "@/features/draftingJobs/types";
import { useUpdatePolicyText } from "@/features/policies/api/hooks";
import type { Policy } from "@/features/policies/types";
import { useRegulation } from "@/features/regulations/api/hooks";
import type { Regulation } from "@/features/regulations/types";
import type { Rule } from "@/features/rules/types";
import { useI18n } from "@/i18n/I18nProvider";
import { useRolePermissions } from "@/features/users/api/hooks";
import { RoleGateNotice } from "@/features/users/components/RoleGateNotice";

import {
  useApprovePolicyDraft,
  useDraftedRules,
  useFinishRuleReview,
  useStartPolicyDrafting,
  useWizardCapabilities,
  useWizardRun,
} from "../api/hooks";
import type { DraftPoliciesInput, PolicyDraftResult } from "../types";
import type { WizardRun } from "../wizardRun";
import { AiProgress } from "./AiProgress";
import { PolicyDraftStep } from "./PolicyDraftStep";
import { RuleReviewStep } from "./RuleReviewStep";
import { SourceStep } from "./SourceStep";
import styles from "./Wizard.module.css";
import { WizardStepper, type WizardStep } from "./WizardStepper";

type WizardState =
  | { step: "source" }
  | { step: "resuming"; jobId: string }
  /** After a failure the step keeps the approved policies, their rules jobs and the edited texts for a retry. */
  | (Extract<WizardRun, { step: "policy" }> & { policyTexts: Record<string, string> })
  | Exclude<WizardRun, { step: "policy" }>
  | { step: "review"; draft: PolicyDraftResult; rules: Rule[]; rulesJobIds: string[] }
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
  switch (state.step) {
    case "source":
    case "resuming":
      return "source";
    case "drafting":
      return "policy";
    case "policy":
      return isApprovingPolicies ? "rules" : "policy";
    default:
      return state.step;
  }
}

function replacePolicy(draft: PolicyDraftResult, updatedPolicy: Policy): PolicyDraftResult {
  return {
    ...draft,
    policies: draft.policies.map((policy) => (policy.id === updatedPolicy.id ? updatedPolicy : policy)),
  };
}

function toWizardState(run: WizardRun): WizardState {
  return run.step === "policy" ? { ...run, policyTexts: {} } : run;
}

function ResumingStep({ jobId, onResumed }: { jobId: string; onResumed: (run: WizardRun) => void }) {
  const { t } = useI18n();
  const runQuery = useWizardRun(jobId);
  const run = runQuery.data;
  useEffect(() => {
    if (run) {
      onResumed(run);
    }
  }, [run, onResumed]);
  if (runQuery.isError) {
    return <ErrorState error={runQuery.error} onRetry={() => void runQuery.refetch()} />;
  }
  return <LoadingRing label={t.wizard.resuming} />;
}

function PolicyDraftingStep({ policyJobId, onSucceeded }: { policyJobId: string; onSucceeded: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const jobQuery = useDraftingJob(policyJobId);
  const retryMutation = useRetryDraftingJob();
  const job = jobQuery.data;
  const hasSucceeded = job?.status === "succeeded";
  useRefreshDraftedArtifacts(job);
  useEffect(() => {
    if (hasSucceeded) {
      onSucceeded();
    }
  }, [hasSucceeded, onSucceeded]);

  if (jobQuery.isPending || hasSucceeded) {
    return <LoadingRing label={hasSucceeded ? t.wizard.loadingDrafts : t.wizard.resuming} />;
  }
  if (!job) {
    return <ErrorState error={jobQuery.error} onRetry={() => void jobQuery.refetch()} />;
  }
  return (
    <>
      {(jobQuery.error || retryMutation.error) && (
        <ErrorState error={jobQuery.error ?? retryMutation.error} />
      )}
      <AiProgress
        title={t.wizard.policyProgressTitle}
        jobs={[job]}
        isFetching={jobQuery.isFetching}
        onRefresh={() => void jobQuery.refetch()}
        isRetrying={retryMutation.isPending}
        onRetry={(jobId) =>
          retryMutation.mutate(jobId, {
            onSuccess: (retriedJob) => router.replace(wizardRunHref(retriedJob.id)),
          })
        }
      />
    </>
  );
}

function RulesDraftingStep({
  draft,
  rulesJobIds,
  onRulesLoaded,
  onJobRetried,
}: {
  draft: PolicyDraftResult;
  rulesJobIds: string[];
  onRulesLoaded: (rules: Rule[]) => void;
  onJobRetried: (failedJobId: string, retriedJobId: string) => void;
}) {
  const { t } = useI18n();
  const jobGroup = useDraftingJobGroup(rulesJobIds);
  const retryMutation = useRetryDraftingJob();
  const haveAllSucceeded =
    jobGroup.jobs.length === rulesJobIds.length && jobGroup.jobs.every((job) => job.status === "succeeded");
  const rulesQuery = useDraftedRules(
    draft.policies.map((policy) => policy.id),
    { enabled: haveAllSucceeded },
  );
  const rules = rulesQuery.data;
  useEffect(() => {
    if (rules) {
      onRulesLoaded(rules);
    }
  }, [rules, onRulesLoaded]);

  if (rulesQuery.isError) {
    return <ErrorState error={rulesQuery.error} onRetry={() => void rulesQuery.refetch()} />;
  }
  if (jobGroup.isPending || haveAllSucceeded) {
    return <LoadingRing label={haveAllSucceeded ? t.wizard.loadingDrafts : t.wizard.resuming} />;
  }
  return (
    <>
      {(jobGroup.error || retryMutation.error) && (
        <ErrorState error={jobGroup.error ?? retryMutation.error} />
      )}
      <AiProgress
        title={t.wizard.rulesProgressTitle}
        jobs={jobGroup.jobs}
        isFetching={jobGroup.isFetching}
        onRefresh={() => void jobGroup.refetch()}
        isRetrying={retryMutation.isPending}
        onRetry={(jobId) =>
          retryMutation.mutate(jobId, { onSuccess: (retriedJob) => onJobRetried(jobId, retriedJob.id) })
        }
      />
    </>
  );
}

function WizardFlow({
  existingRegulation,
  jobId,
}: {
  existingRegulation: Regulation | null;
  jobId: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const capabilities = useWizardCapabilities();
  const { canDraftPolicies } = useRolePermissions();
  const [state, setState] = useState<WizardState>(() =>
    jobId ? { step: "resuming", jobId } : { step: "source" },
  );
  // Approval runs several requests in a row, so no single mutation is pending the whole time.
  const [isApprovingPolicies, setIsApprovingPolicies] = useState(false);
  const startDraftingMutation = useStartPolicyDrafting();
  const updatePolicyMutation = useUpdatePolicyText();
  const approvePolicyDraftMutation = useApprovePolicyDraft();
  const finishReviewMutation = useFinishRuleReview();

  const [isOpeningRun, startOpeningRun] = useTransition();

  const startDrafting = (input: DraftPoliciesInput) =>
    startDraftingMutation.mutate(input, {
      onSuccess: (job) => startOpeningRun(() => router.replace(wizardRunHref(job.id))),
    });

  const resume = useCallback((run: WizardRun) => setState(toWizardState(run)), []);

  const reloadRun = useCallback(() => {
    if (jobId) {
      setState({ step: "resuming", jobId });
    }
  }, [jobId]);

  const showRules = useCallback(
    (rules: Rule[]) =>
      setState((current) =>
        current.step === "rules"
          ? { step: "review", draft: current.draft, rules, rulesJobIds: current.rulesJobIds }
          : current,
      ),
    [],
  );

  const replaceRulesJob = (failedJobId: string, retriedJobId: string) =>
    setState((current) =>
      current.step === "rules"
        ? {
            ...current,
            rulesJobIds: current.rulesJobIds.map((rulesJobId) =>
              rulesJobId === failedJobId ? retriedJobId : rulesJobId,
            ),
          }
        : current,
    );

  // Saves edited texts as new policy versions, then approves each policy; each approval starts a rules job.
  const approvePolicies = async (
    current: Extract<WizardState, { step: "policy" }>,
    policyTexts: Record<string, string>,
  ) => {
    let draft = current.draft;
    const approvedPolicyIds = [...current.approvedPolicyIds];
    const rulesJobIds = [...current.rulesJobIds];
    setIsApprovingPolicies(true);
    try {
      for (const policy of current.draft.policies.filter(
        (candidate) => !approvedPolicyIds.includes(candidate.id),
      )) {
        const text = policyTexts[policy.id] ?? policy.text;
        if (text !== policy.text) {
          draft = replacePolicy(draft, await updatePolicyMutation.mutateAsync({ policyId: policy.id, text }));
        }
        const { rulesJob } = await approvePolicyDraftMutation.mutateAsync(policy.id);
        approvedPolicyIds.push(policy.id);
        if (rulesJob) {
          rulesJobIds.push(rulesJob.id);
        }
      }
      setState({ step: "rules", policyJobId: current.policyJobId, draft, rulesJobIds });
    } catch {
      // The failure is rendered from the mutation error state; the progress so far is kept for a retry.
      setState({ ...current, draft, approvedPolicyIds, rulesJobIds, policyTexts });
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

  const restart = () => router.push("/wizard");

  const stepError =
    startDraftingMutation.error ??
    updatePolicyMutation.error ??
    approvePolicyDraftMutation.error ??
    finishReviewMutation.error;

  return (
    <>
      <WizardStepper currentStep={findStepperStep(state, isApprovingPolicies)} />
      {stepError && !isApprovingPolicies && <ErrorState error={stepError} />}

      {state.step === "source" &&
        (startDraftingMutation.isPending || isOpeningRun ? (
          <LoadingRing label={t.wizard.policyProgressTitle} />
        ) : (
          <>
            {canDraftPolicies ? (
              <SourceStep
                existingRegulation={existingRegulation}
                capabilities={capabilities}
                onSubmit={startDrafting}
              />
            ) : (
              <RoleGateNotice requiredRole="compliance_analyst" />
            )}
            <DraftingJobsPanel />
          </>
        ))}

      {state.step === "resuming" && <ResumingStep jobId={state.jobId} onResumed={resume} />}

      {state.step === "drafting" && (
        <PolicyDraftingStep policyJobId={state.policyJobId} onSucceeded={reloadRun} />
      )}

      {state.step === "policy" &&
        (isApprovingPolicies ? (
          <LoadingRing label={t.wizard.approvingPolicies} />
        ) : (
          <PolicyDraftStep
            draft={state.draft}
            initialPolicyTexts={state.policyTexts}
            approvedPolicyIds={state.approvedPolicyIds}
            onApprove={(policyTexts) => void approvePolicies(state, policyTexts)}
          />
        ))}

      {state.step === "rules" && (
        <RulesDraftingStep
          draft={state.draft}
          rulesJobIds={state.rulesJobIds}
          onRulesLoaded={showRules}
          onJobRetried={replaceRulesJob}
        />
      )}

      {state.step === "review" && (
        <RuleReviewStep
          rules={state.rules}
          rulesJobIds={state.rulesJobIds}
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
  return <WizardFlow existingRegulation={regulationQuery.data ?? null} jobId={null} />;
}

function WizardContent({ regulationId, jobId }: { regulationId: string | null; jobId: string | null }) {
  const { t } = useI18n();
  const { isAvailable } = useWizardCapabilities();
  if (!isAvailable) {
    return (
      <Notice tone="info" title={t.wizard.unavailableTitle}>
        {t.wizard.unavailableMessage}
      </Notice>
    );
  }
  // Without the key, opening another run from the jobs list would keep the current run's state.
  if (jobId) {
    return <WizardFlow key={jobId} existingRegulation={null} jobId={jobId} />;
  }
  return regulationId ? (
    <WizardForRegulation regulationId={regulationId} />
  ) : (
    <WizardFlow existingRegulation={null} jobId={null} />
  );
}

export function WizardScreen({ regulationId, jobId }: { regulationId: string | null; jobId: string | null }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        backLink={{ href: "/", label: t.nav.dashboard }}
        title={t.wizard.title}
        description={t.wizard.subtitle}
      />
      <WizardContent regulationId={regulationId} jobId={jobId} />
    </>
  );
}
