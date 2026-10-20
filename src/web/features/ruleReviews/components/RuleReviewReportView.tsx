"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import tableStyles from "@/components/ui/DataTable.module.css";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { Notice } from "@/components/ui/Notice";
import { ProgressBar } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/StateViews";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

import { groupFindings } from "../domain/findingGroups";
import type { RuleReviewReport } from "../types";
import {
  AssociationCard,
  CoverageGapCard,
  HypothesisCard,
  RecalibrationTable,
  RuleFindingCard,
} from "./FindingCards";
import styles from "./GapAnalysis.module.css";

const DIGEST_PREFIX_LENGTH = 12;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2>{title}</h2>
        {hint && <p className={styles.hint}>{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function ReviewProgress({ report }: { report: RuleReviewReport }) {
  const { t } = useI18n();
  const { stage, done, total } = report.progress;
  const stageLabel = t.ruleReviews.stages[stage as keyof typeof t.ruleReviews.stages] ?? stage;
  return (
    <section className={`${styles.progress} rf-fade-in`} aria-live="polite">
      <h2>{t.ruleReviews.running}</h2>
      <p>
        {t.ruleReviews.stage}: <strong>{stageLabel}</strong>
      </p>
      <ProgressBar percent={total > 0 ? (done / total) * 100 : 0} label={stageLabel} />
    </section>
  );
}

function CoverageMatrix({ report }: { report: RuleReviewReport }) {
  const { t } = useI18n();
  return (
    <Card title={t.ruleReviews.coverageMatrix}>
      <div className={tableStyles.wrapper}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">{t.ruleReviews.indicator}</th>
              <th scope="col">{t.common.name}</th>
              <th scope="col">{t.ruleReviews.coveredBy}</th>
            </tr>
          </thead>
          <tbody>
            {report.coverageMatrix.map((row) => (
              <tr key={row.indicator}>
                <td className={tableStyles.mono}>{row.indicator}</td>
                <td>{row.label}</td>
                <td>
                  {row.ruleCodes.length > 0 ? (
                    row.ruleCodes.join(", ")
                  ) : (
                    <Badge tone="warning">{t.ruleReviews.notCovered}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function RuleReviewReportView({ report }: { report: RuleReviewReport }) {
  const { t, locale } = useI18n();

  if (report.status === "running") {
    return <ReviewProgress report={report} />;
  }
  if (report.status === "failed") {
    return (
      <Notice tone="compliance" title={t.ruleReviews.failed}>
        {report.errorMessage ?? t.common.unknownError}
      </Notice>
    );
  }

  const groups = groupFindings(report.findings);
  const returnPath = `/rules/gap-analysis?review=${report.id}`;
  const { explanations, critiques } = report.llm;

  return (
    <div className={styles.stack}>
      <Card title={t.ruleReviews.summary}>
        <KeyValueList
          items={[
            { label: t.ruleReviews.startedAt, value: formatDateTime(report.startedAt, locale) },
            {
              label: t.ruleReviews.finishedAt,
              value: report.finishedAt ? formatDateTime(report.finishedAt, locale) : "–",
            },
            { label: t.ruleReviews.ruleVersions, value: report.input.ruleVersionIds.length },
            {
              label: t.ruleReviews.transactionSet,
              value: (
                <span className={tableStyles.mono}>
                  {report.input.transactionSetDigest.slice(0, DIGEST_PREFIX_LENGTH)}
                </span>
              ),
            },
            { label: t.ruleReviews.engineVersion, value: report.engineVersion },
            ...(Object.keys(t.ruleReviews.kinds) as (keyof typeof t.ruleReviews.kinds)[]).map((kind) => ({
              label: t.ruleReviews.kinds[kind],
              value: report.findings.filter((finding) => finding.kind === kind).length,
            })),
          ]}
        />
      </Card>
      {report.llm.summary && (
        <Notice tone="ai" title={t.ruleReviews.llmSummary}>
          {report.llm.summary}
        </Notice>
      )}
      {report.llm.summaryUnverifiedNumbers.length > 0 && (
        <Badge tone="warning">
          {formatMessage(t.ruleReviews.summaryUnverifiedNumbers, {
            numbers: report.llm.summaryUnverifiedNumbers.join(", "),
          })}
        </Badge>
      )}
      {report.llm.errors.length > 0 && <Notice tone="info">{t.ruleReviews.llmErrors}</Notice>}
      <CoverageMatrix report={report} />
      <Section title={t.ruleReviews.gaps} hint={t.ruleReviews.gapsHint}>
        {groups.gaps.length === 0 ? (
          <EmptyState message={t.ruleReviews.noGaps} />
        ) : (
          <div className={styles.findingGrid}>
            {groups.gaps.map((finding) => (
              <RuleFindingCard
                key={finding.id}
                finding={finding}
                explanation={explanations[finding.id]}
                critique={critiques[finding.id]}
                returnPath={returnPath}
              />
            ))}
          </div>
        )}
      </Section>
      {groups.recalibrations.length > 0 && (
        <Section title={t.ruleReviews.recalibrations} hint={t.ruleReviews.recalibrationsHint}>
          <RecalibrationTable findings={groups.recalibrations} />
        </Section>
      )}
      {groups.proposedRules.length > 0 && (
        <Section title={t.ruleReviews.proposedRules}>
          <div className={styles.findingGrid}>
            {groups.proposedRules.map((finding) => (
              <RuleFindingCard
                key={finding.id}
                finding={finding}
                explanation={explanations[finding.id]}
                returnPath={returnPath}
              />
            ))}
          </div>
        </Section>
      )}
      {groups.coverageGaps.length > 0 && (
        <Section title={t.ruleReviews.coverageGaps}>
          <div className={styles.findingGrid}>
            {groups.coverageGaps.map((finding) => (
              <CoverageGapCard key={finding.id} finding={finding} />
            ))}
          </div>
        </Section>
      )}
      <Section title={t.ruleReviews.associations} hint={t.ruleReviews.associationsHint}>
        {groups.associations.length === 0 ? (
          <EmptyState message={t.ruleReviews.noAssociations} />
        ) : (
          <div className={styles.stack}>
            {groups.associations.map((finding) => (
              <AssociationCard
                key={finding.id}
                finding={finding}
                explanation={explanations[finding.id]}
                returnPath={returnPath}
              />
            ))}
          </div>
        )}
      </Section>
      {report.llm.hypotheses.length > 0 && (
        <Section title={t.ruleReviews.hypotheses}>
          <div className={styles.findingGrid}>
            {report.llm.hypotheses.map((hypothesis) => (
              <HypothesisCard key={hypothesis.id} hypothesis={hypothesis} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
