"use client";

import { Check } from "lucide-react";

import { useI18n } from "@/i18n/I18nProvider";

import styles from "./Wizard.module.css";

export const WIZARD_STEPS = ["source", "policy", "rules", "review", "done"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export function WizardStepper({ currentStep }: { currentStep: WizardStep }) {
  const { t } = useI18n();
  const currentIndex = WIZARD_STEPS.indexOf(currentStep);
  return (
    <ol className={styles.stepper}>
      {WIZARD_STEPS.map((step, stepIndex) => {
        const isDone = stepIndex < currentIndex;
        const isCurrent = stepIndex === currentIndex;
        return (
          <li
            key={step}
            className={`${styles.stepperItem} ${isDone ? styles.stepperDone : ""} ${isCurrent ? styles.stepperCurrent : ""}`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className={styles.stepperNumber} aria-hidden="true">
              {isDone ? <Check /> : stepIndex + 1}
            </span>
            {t.wizard.steps[step]}
          </li>
        );
      })}
    </ol>
  );
}
