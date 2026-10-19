"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { LoadingRing } from "@/components/ui/LoadingRing";
import { ProgressBar } from "@/components/ui/Progress";
import { StepProgress, type ProgressStep, type StepState } from "@/components/ui/StepProgress";

import styles from "./Wizard.module.css";

const STEP_INTERVAL_MS = 650;

function findStepState(stepIndex: number, activeIndex: number): StepState {
  if (stepIndex < activeIndex) {
    return "done";
  }
  return stepIndex === activeIndex ? "active" : "pending";
}

/**
 * Visualises an AI request that has no server-side progress events: steps advance on a timer and the last one
 * stays active until the request resolves and the parent unmounts this view.
 */
export function AiProgress({ title, stepLabels }: { title: string; stepLabels: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIndex = stepLabels.length - 1;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => Math.min(lastIndex, currentIndex + 1));
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [lastIndex]);

  const steps: ProgressStep[] = stepLabels.map((label, stepIndex) => ({
    label,
    state: findStepState(stepIndex, activeIndex),
  }));
  const percent = ((activeIndex + 0.5) / stepLabels.length) * 100;

  return (
    <section className={`${styles.aiProgress} rf-fade-in`} aria-live="polite">
      <div className={styles.aiProgressHeader}>
        <span className={styles.aiPulse} aria-hidden="true">
          <Sparkles />
        </span>
        <h2>{title}</h2>
      </div>
      <LoadingRing label={stepLabels[activeIndex]} />
      <StepProgress steps={steps} />
      <ProgressBar percent={percent} label={title} />
    </section>
  );
}
