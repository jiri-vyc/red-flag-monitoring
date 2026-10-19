"use client";

import { ArrowRight, Check, ChevronRight, Circle, CircleSlash, ListChecks, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { findScoreTone, ScoreBar } from "@/components/ui/ScoreBar";
import { EmptyState, QueryView } from "@/components/ui/StateViews";
import { RuleTypeBadge } from "@/features/rules/components/RuleBadges";
import { useI18n } from "@/i18n/I18nProvider";
import { formatAmount, formatDateTime } from "@/lib/format";

import { useTransactionEvaluation } from "../api/hooks";
import type { RuleEvaluation, TransactionEvaluation } from "../types";
import { BucketBadge } from "./BucketBadge";
import styles from "./TransactionEvaluationScreen.module.css";
import { useCurrentUser } from "@/features/users/api/hooks";
import { formatMessage } from "@/i18n/dictionaries";

function TraceTimeline({ evaluation }: { evaluation: RuleEvaluation }) {
  return (
    <ol className={styles.trace}>
      {evaluation.trace.map((traceStep) => (
        <li key={traceStep.condition} className={traceStep.isMet ? styles.traceMet : styles.traceNotMet}>
          <span className={styles.traceIcon} aria-hidden="true">
            {traceStep.isMet ? <Check /> : <Circle />}
          </span>
          <span className={styles.traceText}>
            <strong>{traceStep.condition}</strong>
            <small>{traceStep.detail}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Only a deterministic rule with a known base score has a fixed score: its whole base score when it matches. */
function findKnownBaseScore(evaluation: RuleEvaluation): number | null {
  return evaluation.ruleType === "deterministic" ? evaluation.baseScore : null;
}

function ScoreCalculation({ evaluation }: { evaluation: RuleEvaluation }) {
  const { t } = useI18n();
  const baseScore = findKnownBaseScore(evaluation);
  if (baseScore === null) {
    return (
      <>
        <ScoreBar score={evaluation.score} label={t.transactionDetail.score} />
        <p className={styles.sensitivityStep}>
          × {t.transactionDetail.sensitivity} <strong>{evaluation.sensitivity} %</strong>
        </p>
        <ScoreBar score={evaluation.adjustedScore} label={t.transactionDetail.adjustedScore} />
      </>
    );
  }
  // Failed rules matched (outcome hit); passed rules did not, so their score is 0.
  const matchLabel = evaluation.isFailed
    ? t.transactionDetail.matchedScore
    : t.transactionDetail.notMatchedScore;
  return (
    <>
      <div className={styles.baseScore}>
        <p className={styles.baseScoreRow}>
          <span>{t.transactionDetail.baseScore}</span>
          <strong>{baseScore}</strong>
        </p>
        <p className={styles.baseScoreHint}>{t.transactionDetail.baseScoreHint}</p>
      </div>
      <ScoreBar score={evaluation.score} label={matchLabel} />
      <p className={styles.sensitivityStep}>
        × {t.transactionDetail.sensitivity} <strong>{evaluation.sensitivity} %</strong>
      </p>
      <ScoreBar score={evaluation.adjustedScore} label={`= ${t.transactionDetail.adjustedScore}`} />
    </>
  );
}

const SCORE_TILE_CLASS = {
  low: styles.scoreTileLow,
  medium: styles.scoreTileMedium,
  high: styles.scoreTileHigh,
};

function FailedRuleCard({ evaluation }: { evaluation: RuleEvaluation }) {
  const { t } = useI18n();
  const scoreTileClass = SCORE_TILE_CLASS[findScoreTone(evaluation.adjustedScore)];
  return (
    <article className={`${styles.ruleCard} rf-slide-up`}>
      <header className={styles.ruleHeader}>
        <div
          className={`${styles.scoreTile} ${scoreTileClass}`}
          aria-label={`${t.transactionDetail.adjustedScore}: ${evaluation.adjustedScore} / 100`}
        >
          <strong>{evaluation.adjustedScore}</strong>
          <small>/ 100</small>
        </div>
        <div className={styles.ruleTitle}>
          <h3>{evaluation.ruleName}</h3>
          <span className={styles.ruleMeta}>
            <RuleTypeBadge type={evaluation.ruleType} />
            <span>v{evaluation.ruleVersionNumber}</span>
            <span>
              {t.rules.escalationRole}: {t.roles[evaluation.escalationRole]}
            </span>
          </span>
        </div>
        <Link href={`/rules/${evaluation.ruleId}`} className={styles.ruleLink}>
          {t.transactionDetail.openRule}
          <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      <div className={styles.ruleBody}>
        <div>
          <h4 className={styles.traceTitle}>{t.transactionDetail.trace}</h4>
          <TraceTimeline evaluation={evaluation} />
        </div>
        <aside className={styles.scorePanel}>
          <ScoreCalculation evaluation={evaluation} />
        </aside>
      </div>
    </article>
  );
}

function PassedRuleList({ evaluations }: { evaluations: RuleEvaluation[] }) {
  const { t } = useI18n();
  return (
    <ul className={styles.ruleRowList}>
      {evaluations.map((evaluation) => {
        const baseScore = findKnownBaseScore(evaluation);
        return (
          <li key={evaluation.ruleId}>
            <details className={styles.passedRule}>
              <summary>
                <ChevronRight aria-hidden="true" className={styles.disclosureIcon} />
                <span className={styles.passedRuleName}>
                  <strong>{evaluation.ruleName}</strong>
                  <small>
                    v{evaluation.ruleVersionNumber}
                    {baseScore !== null && ` · ${t.transactionDetail.baseScore} ${baseScore}`} ·{" "}
                    {t.transactionDetail.adjustedScore} {evaluation.adjustedScore}
                  </small>
                </span>
                <Link href={`/rules/${evaluation.ruleId}`} className={styles.inlineRuleLink}>
                  {t.transactionDetail.openRule}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </summary>
              <div className={styles.passedRuleTrace}>
                <TraceTimeline evaluation={evaluation} />
                {baseScore !== null && (
                  <div className={styles.scorePanel}>
                    <ScoreCalculation evaluation={evaluation} />
                  </div>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function TransactionEvaluationDetail({ evaluation }: { evaluation: TransactionEvaluation }) {
  const { t, locale } = useI18n();
  const { activeRole } = useCurrentUser();
  const { transaction, client } = evaluation;
  return (
    <>
      <PageHeader
        backLink={{
          href: `/batches/${evaluation.batchId}?bucket=${evaluation.bucket}`,
          label: t.transactionDetail.backToBatch,
        }}
        title={transaction.transactionId}
        meta={<BucketBadge bucket={evaluation.bucket} />}
        description={t.transactionDetail.title}
      />
      <div className={styles.facts}>
        <Card title={t.transactionDetail.transaction}>
          <KeyValueList
            items={[
              { label: t.batches.bookedAt, value: formatDateTime(transaction.bookedAt, locale) },
              {
                label: t.batches.amount,
                value: formatAmount({ amount: transaction.amount, currency: transaction.currency, locale }),
              },
              {
                label: t.transactionDetail.amountCzk,
                value:
                  transaction.amountCzk === null
                    ? t.common.noData
                    : formatAmount({ amount: transaction.amountCzk, currency: "CZK", locale }),
              },
              { label: t.transactionDetail.type, value: transaction.transactionType },
              {
                label: t.batches.route,
                value: `${transaction.payerCountry || "–"} → ${transaction.payeeCountry || "–"}`,
              },
              { label: t.transactionDetail.payerAccount, value: transaction.payerAccount || "–" },
              { label: t.transactionDetail.payeeAccount, value: transaction.payeeAccount || "–" },
            ]}
          />
        </Card>
        <Card title={t.transactionDetail.client}>
          <KeyValueList
            items={[
              { label: "ID", value: client.id },
              { label: t.transactionDetail.riskProfile, value: t.riskProfile[client.riskProfile] },
              { label: t.transactionDetail.pep, value: client.isPep ? t.common.yes : t.common.no },
              { label: t.transactionDetail.country, value: client.country },
            ]}
          />
        </Card>
      </div>

      <Card
        title={
          <>
            <ListChecks aria-hidden="true" />
            {t.transactionDetail.failedRules} ({evaluation.failedRules.length})
          </>
        }
      >
        <Notice tone="ai">{t.batches.decisionAid}</Notice>
        {evaluation.failedRules.length === 0 ? (
          <EmptyState
            message={
              // A flagged transaction without failed rules here has only hits escalated to other roles (issue #6).
              evaluation.bucket === "ok"
                ? t.transactionDetail.noFailedRules
                : formatMessage(t.transactionDetail.noHitsForRole, { role: t.roles[activeRole] })
            }
          />
        ) : (
          <div className={styles.ruleList}>
            {evaluation.failedRules.map((ruleEvaluation) => (
              <FailedRuleCard key={ruleEvaluation.ruleId} evaluation={ruleEvaluation} />
            ))}
          </div>
        )}
      </Card>

      <div className={styles.facts}>
        <Card
          title={
            <>
              <ShieldCheck aria-hidden="true" />
              {t.transactionDetail.passedRules} ({evaluation.passedRules.length})
            </>
          }
        >
          {evaluation.passedRules.length === 0 ? (
            <p className={styles.muted}>{t.common.none}</p>
          ) : (
            <PassedRuleList evaluations={evaluation.passedRules} />
          )}
        </Card>
        <Card
          title={
            <>
              <CircleSlash aria-hidden="true" />
              {t.transactionDetail.skippedRules} ({evaluation.skippedRules.length})
            </>
          }
        >
          {evaluation.skippedRules.length === 0 ? (
            <p className={styles.muted}>{t.common.none}</p>
          ) : (
            <ul className={styles.ruleRowList}>
              {evaluation.skippedRules.map((skippedRule) => (
                <li key={skippedRule.ruleId}>
                  <Link href={`/rules/${skippedRule.ruleId}`} className={styles.skippedRule}>
                    <span className={styles.passedRuleName}>
                      <strong>{skippedRule.ruleName}</strong>
                      <small>{t.transactionDetail.skipReason[skippedRule.reason]}</small>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export function TransactionEvaluationScreen({
  batchId,
  transactionId,
}: {
  batchId: string;
  transactionId: string;
}) {
  const evaluationQuery = useTransactionEvaluation({ batchId, transactionId });
  return (
    <QueryView query={evaluationQuery}>
      {(evaluation) => <TransactionEvaluationDetail evaluation={evaluation} />}
    </QueryView>
  );
}
