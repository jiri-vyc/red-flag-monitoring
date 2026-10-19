"use client";

import { ListChecks } from "lucide-react";

import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { useI18n } from "@/i18n/I18nProvider";
import { formatNumber } from "@/lib/format";

import type { Batch } from "../types";
import { BucketCountsInline } from "./BucketCountsInline";
import styles from "./BatchDetail.module.css";

export function BatchProgressView({ batch }: { batch: Batch }) {
  const { t, locale } = useI18n();
  const percent =
    batch.evaluatedRowCount === 0 ? 0 : (batch.processedRowCount / batch.evaluatedRowCount) * 100;
  return (
    <section className={`${styles.progressPanel} rf-fade-in`} aria-live="polite">
      <ProgressRing percent={percent} label={t.batches.evaluating} />
      <div className={styles.progressText}>
        <h2>{t.batches.evaluating}</h2>
        <p className={styles.progressCount}>
          <AnimatedCounter value={batch.processedRowCount} format={(value) => formatNumber(value, locale)} />
          <span className={styles.progressTotal}>
            {" "}
            / {formatNumber(batch.evaluatedRowCount, locale)} {t.batches.processedOf}
          </span>
        </p>
        <ProgressBar percent={percent} label={t.batches.evaluating} />
        <p className={styles.progressMeta}>
          <ListChecks aria-hidden="true" />
          {t.batches.activeRulesUsed}: <strong>{batch.activeRuleCount}</strong>
        </p>
        <div className={styles.progressMeta}>
          {t.batches.foundSoFar}: <BucketCountsInline counts={batch.counts} />
        </div>
      </div>
    </section>
  );
}
