import { Check, Circle, LoaderCircle } from "lucide-react";

import styles from "./StepProgress.module.css";

export type StepState = "done" | "active" | "pending";
export type ProgressStep = { label: string; state: StepState };

const STEP_ICONS = { done: Check, active: LoaderCircle, pending: Circle } as const;

export function StepProgress({ steps }: { steps: ProgressStep[] }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step) => {
        const StepIcon = STEP_ICONS[step.state];
        return (
          <li
            key={step.label}
            className={`${styles.step} ${styles[step.state]}`}
            aria-current={step.state === "active" ? "step" : undefined}
          >
            <span className={styles.icon} aria-hidden="true">
              <StepIcon />
            </span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
