"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldStyles } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErrorState } from "@/components/ui/StateViews";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatNumber } from "@/lib/format";

import { useBatches, useBatchesMode, useStartEvaluationRun } from "../api/hooks";
import { estimateThroughput, findFullDatasetTxCount } from "../domain/runDuration";
import type { RunScope } from "../types";
import { RunDurationEstimate } from "./RunDurationEstimate";
import styles from "./RunEvaluationPanel.module.css";

type ScopeForm = { limit: string; from: string; to: string };

const EMPTY_SCOPE_FORM: ScopeForm = { limit: "", from: "", to: "" };

/** An empty field is left out of the scope; null means the limit is not a positive whole number. */
function parseLimit(limit: string): number | undefined | null {
  if (limit.trim() === "") {
    return undefined;
  }
  const parsedLimit = Number(limit);
  return Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
}

function toOptionalDate(date: string): string | undefined {
  return date === "" ? undefined : date;
}

export function RunEvaluationPanel() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const batchesMode = useBatchesMode();
  const batchesQuery = useBatches();
  const startRunMutation = useStartEvaluationRun();
  const [scopeForm, setScopeForm] = useState(EMPTY_SCOPE_FORM);

  const limit = parseLimit(scopeForm.limit);
  // "YYYY-MM-DD" compares correctly as text.
  const isRangeInvalid = scopeForm.from !== "" && scopeForm.to !== "" && scopeForm.from >= scopeForm.to;
  const isScopeEmpty = limit === undefined && scopeForm.from === "" && scopeForm.to === "";
  // Stays locked after success until the page navigates away: a second click would start another (possibly full-DB) run.
  const isStartLocked = startRunMutation.isPending || startRunMutation.isSuccess;
  const canSubmit = limit !== null && !isRangeInvalid && !isStartLocked;
  // Past runs give the speed; a failed run list falls back to the default speed instead of hiding the estimate.
  const pastRuns = batchesQuery.isPending ? null : (batchesQuery.data ?? []);
  const throughput = pastRuns && estimateThroughput(pastRuns);
  const fullDatasetTxCount = findFullDatasetTxCount(pastRuns ?? []);

  const updateField = (field: keyof ScopeForm) => (value: string) =>
    setScopeForm((current) => ({ ...current, [field]: value }));

  // A started run opens on its detail, which polls the progress.
  const startRun = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    const scope: RunScope = {
      limit: limit ?? undefined,
      from: toOptionalDate(scopeForm.from),
      to: toOptionalDate(scopeForm.to),
    };
    startRunMutation.mutate(scope, {
      onSuccess: (batch) => router.push(`/batches/${encodeURIComponent(batch.id)}`),
    });
  };

  return (
    <Card title={t.batches.runPanelTitle}>
      <form className={styles.form} onSubmit={startRun} noValidate>
        <p className={styles.hint}>{t.batches.runPanelHint}</p>
        <div className={styles.fields}>
          <Field
            label={t.batches.scopeLimit}
            htmlFor="run-scope-limit"
            hint={t.batches.scopeLimitHint}
            error={limit === null ? t.batches.scopeLimitError : null}
          >
            <input
              id="run-scope-limit"
              className={fieldStyles.input}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={scopeForm.limit}
              onChange={(event) => updateField("limit")(event.target.value)}
            />
          </Field>
          <Field label={t.batches.scopeFrom} htmlFor="run-scope-from">
            <input
              id="run-scope-from"
              className={fieldStyles.input}
              type="date"
              value={scopeForm.from}
              onChange={(event) => updateField("from")(event.target.value)}
            />
          </Field>
          <Field
            label={t.batches.scopeTo}
            htmlFor="run-scope-to"
            error={isRangeInvalid ? t.batches.scopeRangeError : null}
          >
            <input
              id="run-scope-to"
              className={fieldStyles.input}
              type="date"
              value={scopeForm.to}
              onChange={(event) => updateField("to")(event.target.value)}
            />
          </Field>
        </div>
        {/* The mock runs over a small demo sample; only the database holds the full dataset. */}
        {isScopeEmpty && batchesMode === "live" && (
          <Notice tone="compliance">
            <span className={styles.estimateLine}>
              {formatMessage(t.batches.fullRunWarning, { count: formatNumber(fullDatasetTxCount, locale) })}
            </span>
            {throughput && (
              <RunDurationEstimate txCount={fullDatasetTxCount} isFullRun throughput={throughput} />
            )}
          </Notice>
        )}
        {/* With a limit, its estimate replaces the full-dataset warning; it also bounds a date range. */}
        {typeof limit === "number" && throughput && (
          <Notice tone="info" title={t.batches.durationEstimateTitle}>
            <RunDurationEstimate txCount={limit} isFullRun={false} throughput={throughput} />
          </Notice>
        )}
        {limit === undefined && !isScopeEmpty && (
          <Notice tone="info" title={t.batches.durationEstimateTitle}>
            {t.batches.durationRangeUnknown}
          </Notice>
        )}
        <div className={styles.actions}>
          <Button type="submit" icon={<Play aria-hidden="true" />} disabled={!canSubmit}>
            {isStartLocked ? t.batches.startingRun : t.batches.startRun}
          </Button>
        </div>
      </form>
      {startRunMutation.error && <ErrorState error={startRunMutation.error} />}
    </Card>
  );
}
