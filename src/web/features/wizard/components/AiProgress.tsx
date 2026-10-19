"use client";

import { RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { LoadingRing } from "@/components/ui/LoadingRing";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { StepProgress, type ProgressStep, type StepState } from "@/components/ui/StepProgress";
import { useDraftingJobPollIntervalMs } from "@/features/draftingJobs/api/hooks";
import { isDraftingJobInFlight, type DraftingJob } from "@/features/draftingJobs/types";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatElapsedTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";

import styles from "./Wizard.module.css";

const PROGRESS_STAGES = ["pending", "running", "succeeded"] as const;
type ProgressStage = (typeof PROGRESS_STAGES)[number];

const ELAPSED_TICK_MS = 1_000;

function findProgressStage(jobs: DraftingJob[]): ProgressStage {
  if (jobs.some((job) => job.status === "pending")) {
    return "pending";
  }
  return jobs.some((job) => job.status === "running") ? "running" : "succeeded";
}

function findStepState(stage: ProgressStage, currentStage: ProgressStage): StepState {
  const stageIndex = PROGRESS_STAGES.indexOf(stage);
  const currentIndex = PROGRESS_STAGES.indexOf(currentStage);
  if (stageIndex < currentIndex || currentStage === "succeeded") {
    return "done";
  }
  return stageIndex === currentIndex ? "active" : "pending";
}

function JobFailure({
  job,
  isRetrying,
  onRetry,
}: {
  job: DraftingJob;
  isRetrying: boolean;
  onRetry: (jobId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.jobFailure} role="alert">
      <strong>{t.draftingJobs.failedTitle}</strong>
      <p>{job.errorMessage ?? t.draftingJobs.noErrorMessage}</p>
      <div>
        <Button
          variant="secondary"
          icon={<RotateCcw aria-hidden="true" />}
          disabled={isRetrying}
          onClick={() => onRetry(job.id)}
        >
          {isRetrying ? t.draftingJobs.retrying : t.draftingJobs.retry}
        </Button>
      </div>
    </div>
  );
}

type AiProgressProps = {
  title: string;
  jobs: DraftingJob[];
  isFetching: boolean;
  onRefresh: () => void;
  isRetrying: boolean;
  onRetry: (jobId: string) => void;
};

export function AiProgress({ title, jobs, isFetching, onRefresh, isRetrying, onRetry }: AiProgressProps) {
  const { t } = useI18n();
  const pollIntervalMs = useDraftingJobPollIntervalMs();
  const inFlightJobs = jobs.filter(isDraftingJobInFlight);
  const activeJobs = jobs.filter((job) => job.status !== "failed");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const isInFlight = inFlightJobs.length > 0;
  const now = useNow(ELAPSED_TICK_MS, isInFlight);
  const stage = findProgressStage(activeJobs);
  const startedAtMs = Math.min(...inFlightJobs.map((job) => Date.parse(job.createdAt)));
  const steps: ProgressStep[] = PROGRESS_STAGES.map((progressStage) => ({
    label: t.draftingJobs.progress[progressStage],
    state: findStepState(progressStage, stage),
  }));

  return (
    <section className={`${styles.aiProgress} rf-fade-in`} aria-live="polite" aria-busy={isFetching}>
      <div className={styles.aiProgressHeader}>
        <span className={styles.aiPulse} aria-hidden="true">
          <Sparkles />
        </span>
        <h2>{title}</h2>
        <RefreshButton label={t.draftingJobs.refresh} isFetching={isFetching} onRefresh={onRefresh} />
      </div>
      {isInFlight && (
        <LoadingRing
          label={`${t.draftingJobs.progress[stage]} · ${formatMessage(t.draftingJobs.elapsed, {
            time: formatElapsedTime(now - startedAtMs),
          })}`}
        />
      )}
      {activeJobs.length > 0 && <StepProgress steps={steps} />}
      {failedJobs.map((job) => (
        <JobFailure key={job.id} job={job} isRetrying={isRetrying} onRetry={onRetry} />
      ))}
      {isInFlight && (
        <p className={styles.muted}>
          {t.draftingJobs.canLeave}{" "}
          {formatMessage(t.draftingJobs.autoRefresh, { seconds: Math.round(pollIntervalMs / 1000) })}
        </p>
      )}
    </section>
  );
}
