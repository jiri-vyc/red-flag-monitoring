"use client";

import { Sparkles, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import tableStyles from "@/components/ui/DataTable.module.css";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatNumber } from "@/lib/format";

import { formatStepPercent, parseSeedReason } from "../domain/findingGroups";
import { type Finding, type FindingExplanation, isParameterProposal, type RuleHypothesis } from "../types";
import { ClientLink, CopyClientIdsButton, FindingClientsTable } from "./FindingClientsTable";
import styles from "./GapAnalysis.module.css";

type StrongFlow = { account: string; seedClientId: string; hoursBetween: number };

function readString(evidence: Record<string, unknown>, key: string): string | null {
  const value = evidence[key];
  return typeof value === "string" ? value : null;
}

function readNumber(evidence: Record<string, unknown>, key: string): number | null {
  const value = evidence[key];
  return typeof value === "number" ? value : null;
}

function readStrongFlows(evidence: Record<string, unknown>): StrongFlow[] {
  const value = evidence.strongFlows;
  return Array.isArray(value) ? (value as StrongFlow[]) : [];
}

function ExplanationView({ explanation, critique }: { explanation?: FindingExplanation; critique?: string }) {
  const { t } = useI18n();
  if (!explanation && !critique) {
    return null;
  }
  return (
    <Card tone="ai" title={t.ruleReviews.explanation}>
      <div className={styles.explanation}>
        {explanation && (
          <>
            <p>{explanation.summary}</p>
            <p>
              <strong>{t.ruleReviews.typology}:</strong> {explanation.typology}
            </p>
            <p>
              <strong>{t.ruleReviews.considerations}:</strong> {explanation.adjustmentConsiderations}
            </p>
            <strong>{t.ruleReviews.investigationSteps}</strong>
            <ul>
              {explanation.investigationSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            {explanation.unverifiedCitations.length > 0 && (
              <Badge tone="warning" icon={<TriangleAlert aria-hidden="true" />}>
                {formatMessage(t.ruleReviews.unverifiedCitations, {
                  count: explanation.unverifiedCitations.length,
                })}
              </Badge>
            )}
          </>
        )}
        {critique && (
          <p>
            <Sparkles aria-hidden="true" /> <strong>{t.ruleReviews.critique}:</strong> {critique}
          </p>
        )}
      </div>
    </Card>
  );
}

export function RuleFindingCard({
  finding,
  explanation,
  critique,
  returnPath,
}: {
  finding: Finding;
  explanation?: FindingExplanation;
  critique?: string;
  returnPath: string;
}) {
  const { t, locale } = useI18n();
  const parameterProposal = isParameterProposal(finding.proposal) ? finding.proposal : null;
  const evidenceProposal = finding.evidence.parameter as Finding["proposal"];
  const shownProposal =
    parameterProposal ?? (isParameterProposal(evidenceProposal) ? evidenceProposal : null);
  const addedHits = readNumber(finding.evidence, "addedHits");
  const title = finding.rule ? `${finding.rule.code} · ${finding.rule.label}` : finding.id;

  return (
    <Card title={title}>
      <div className={styles.section}>
        <div className={styles.findingMeta}>
          <span>
            {t.ruleReviews.parameter}:{" "}
            <strong>{readString(finding.evidence, "parameterLabel") ?? shownProposal?.parameter}</strong>
          </span>
          {shownProposal && (
            <span className={styles.proposal}>
              {t.ruleReviews.proposal}: {formatNumber(shownProposal.currentValue, locale)} →{" "}
              <strong>{formatNumber(shownProposal.proposedValue, locale)}</strong> ({t.ruleReviews.step}{" "}
              {formatStepPercent(shownProposal.step)})
            </span>
          )}
          {finding.kind === "new_rule" && <Badge tone="warning">{t.ruleReviews.regulatory}</Badge>}
          {finding.growth?.capExceeded && <Badge tone="danger">{t.ruleReviews.capExceeded}</Badge>}
        </div>
        {finding.growth && (
          <div className={styles.findingMeta}>
            <span>
              {t.ruleReviews.growth}:{" "}
              {formatMessage(t.ruleReviews.growthValue, {
                base: formatNumber(finding.growth.baseClients, locale),
                added: formatNumber(finding.growth.addedClients, locale),
              })}
            </span>
            {addedHits !== null && (
              <Badge>{formatMessage(t.ruleReviews.addedHits, { hits: addedHits })}</Badge>
            )}
          </div>
        )}
        <ExplanationView explanation={explanation} critique={critique} />
        {finding.clients.length > 0 && (
          <>
            <FindingClientsTable clients={finding.clients} returnPath={returnPath} />
            <CopyClientIdsButton clientIds={finding.clients.map((client) => client.clientId)} />
          </>
        )}
      </div>
    </Card>
  );
}

export function RecalibrationTable({ findings }: { findings: Finding[] }) {
  const { t, locale } = useI18n();
  return (
    <div className={tableStyles.wrapper}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th scope="col">{t.common.name}</th>
            <th scope="col">{t.ruleReviews.parameter}</th>
            <th scope="col" className={tableStyles.numeric}>
              {t.ruleReviews.step}
            </th>
            <th scope="col">{t.ruleReviews.growth}</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((finding) => {
            const evidenceProposal = finding.evidence.parameter as Finding["proposal"];
            const proposal = isParameterProposal(evidenceProposal) ? evidenceProposal : null;
            return (
              <tr key={finding.id}>
                <td className={tableStyles.primaryCell}>
                  {finding.rule ? `${finding.rule.code} · ${finding.rule.label}` : finding.id}
                </td>
                <td>
                  {readString(finding.evidence, "parameterLabel")}
                  {proposal &&
                    ` (${formatNumber(proposal.currentValue, locale)} → ${formatNumber(proposal.proposedValue, locale)})`}
                </td>
                <td className={tableStyles.numeric}>{proposal ? formatStepPercent(proposal.step) : "–"}</td>
                <td>
                  {finding.growth &&
                    formatMessage(t.ruleReviews.growthValue, {
                      base: formatNumber(finding.growth.baseClients, locale),
                      added: formatNumber(finding.growth.addedClients, locale),
                    })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SeedReasonBadge({ reason }: { reason: string }) {
  const { t } = useI18n();
  const { kind, rule } = parseSeedReason(reason);
  if (kind === "rule_hit" && rule !== null) {
    return <Badge tone="danger">{formatMessage(t.ruleReviews.seedReasons.rule_hit, { rule })}</Badge>;
  }
  const label = kind === "pep" || kind === "risk_score_high" ? t.ruleReviews.seedReasons[kind] : reason;
  return <Badge tone="warning">{label}</Badge>;
}

export function AssociationTable({ findings, returnPath }: { findings: Finding[]; returnPath: string }) {
  const { t } = useI18n();
  return (
    <div className={tableStyles.wrapper}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th scope="col">{t.ruleReviews.client}</th>
            <th scope="col">{t.ruleReviews.seeds}</th>
            <th scope="col">{t.ruleReviews.accounts}</th>
          </tr>
        </thead>
        <tbody>
          {findings.flatMap((finding) =>
            finding.clients.map((client) => (
              <tr key={finding.id}>
                <td>
                  <ClientLink clientId={client.clientId} returnPath={returnPath} />
                </td>
                <td>
                  {client.seedLinks.map((seedLink) => (
                    <div key={seedLink.seedClientId} className={styles.inlineList}>
                      <ClientLink clientId={seedLink.seedClientId} returnPath={returnPath} />
                      {seedLink.seedReasons.map((reason) => (
                        <SeedReasonBadge key={reason} reason={reason} />
                      ))}
                    </div>
                  ))}
                </td>
                <td>
                  <span className={tableStyles.mono}>
                    {(finding.evidence.sharedAccounts as string[] | undefined)?.join(", ")}
                  </span>
                  {readStrongFlows(finding.evidence).map((flow) => (
                    <div key={`${flow.account}-${flow.seedClientId}`} className={tableStyles.secondaryText}>
                      {formatMessage(t.ruleReviews.strongFlow, {
                        account: flow.account,
                        hours: flow.hoursBetween,
                      })}
                    </div>
                  ))}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

export function HypothesisCard({ hypothesis }: { hypothesis: RuleHypothesis }) {
  const { t, locale } = useI18n();
  const { backtest } = hypothesis;
  return (
    <Card tone="ai" title={hypothesis.descriptionCs}>
      <div className={styles.explanation}>
        <div className={styles.findingMeta}>
          {hypothesis.indicator && (
            <Badge tone="ai">
              {formatMessage(t.ruleReviews.indicatorCovered, { indicator: hypothesis.indicator })}
            </Badge>
          )}
          {backtest?.discardReason && (
            <Badge tone="danger">
              {formatMessage(t.ruleReviews.discarded, { reason: backtest.discardReason })}
            </Badge>
          )}
        </div>
        <p>{hypothesis.rationale}</p>
        {hypothesis.missingFeature && (
          <p>
            <strong>{t.ruleReviews.missingFeature}:</strong> <code>{hypothesis.missingFeature}</code>
          </p>
        )}
        {backtest && (
          <p>
            <strong>{t.ruleReviews.backtest}:</strong>{" "}
            {formatMessage(t.ruleReviews.backtestValue, {
              hits: formatNumber(backtest.hitCount, locale),
              clients: formatNumber(backtest.clientCount, locale),
              share: Math.round(backtest.clientShare * 1000) / 10,
            })}
          </p>
        )}
      </div>
    </Card>
  );
}
