import { formatTransactionType } from "@/features/batches/domain/transactionType";
import type { TransactionEvaluation } from "@/features/batches/types";
import type { Rule } from "@/features/rules/types";
import { cs } from "@/i18n/cs";
import { formatAmount, formatDateTime } from "@/lib/format";

import {
  DEFAULT_FAU_REPORT_TYPE,
  type FauReport,
  type FauReportActor,
  type FauReportSource,
  type FauReportSourceRule,
  type ReportingInstitution,
} from "../types";

// An OPO is filed with the Czech FAÚ, so its content is Czech whatever the UI language is.
const REPORT_LOCALE = "cs";
const NOT_KNOWN = "neuvedeno";

function findRuleLegalBases(
  rules: Rule[],
  regulationNames: Record<string, string>,
  { ruleId, ruleVersionNumber }: { ruleId: string; ruleVersionNumber: number },
): string[] {
  const ruleVersion = rules
    .find((rule) => rule.id === ruleId)
    ?.versions.find((version) => version.versionNumber === ruleVersionNumber);
  return (ruleVersion?.legalBases ?? []).map(
    ({ regulationId, ref }) => `${regulationNames[regulationId] ?? regulationId} ${ref}`,
  );
}

/** The alert data the web has loaded, with each failed rule's met trace steps and legal basis. */
export function toFauReportSource({
  evaluation,
  alertRaisedAt,
  rules,
  regulationNames,
}: {
  evaluation: TransactionEvaluation;
  alertRaisedAt: string;
  rules: Rule[];
  regulationNames: Record<string, string>;
}): FauReportSource {
  const { transaction, client } = evaluation;
  return {
    alert: { batchId: evaluation.batchId, transactionId: transaction.transactionId },
    alertRaisedAt,
    transaction: {
      transactionId: transaction.transactionId,
      bookedAt: transaction.bookedAt,
      amount: transaction.amount,
      currency: transaction.currency,
      amountCzk: transaction.amountCzk,
      transactionType: transaction.transactionType,
      payerCountry: transaction.payerCountry,
      payeeCountry: transaction.payeeCountry,
      payerAccount: transaction.payerAccount,
      payeeAccount: transaction.payeeAccount,
    },
    client: { id: client.id, country: client.country, riskProfile: client.riskProfile, isPep: client.isPep },
    failedRules: evaluation.failedRules.map((ruleEvaluation) => ({
      ruleName: ruleEvaluation.ruleName,
      ruleVersionNumber: ruleEvaluation.ruleVersionNumber,
      adjustedScore: ruleEvaluation.adjustedScore,
      reasons: ruleEvaluation.trace
        .filter((traceStep) => traceStep.isMet)
        .map((traceStep) => `${traceStep.condition}: ${traceStep.detail}`),
      legalBases: findRuleLegalBases(rules, regulationNames, ruleEvaluation),
    })),
  };
}

function describeTransaction({ transaction }: FauReportSource): string {
  const amount = formatAmount({
    amount: transaction.amount,
    currency: transaction.currency,
    locale: REPORT_LOCALE,
  });
  const amountCzk =
    transaction.amountCzk === null
      ? NOT_KNOWN
      : formatAmount({ amount: transaction.amountCzk, currency: "CZK", locale: REPORT_LOCALE });
  return [
    `Spouštěcí transakce ${transaction.transactionId} ze dne ${formatDateTime(transaction.bookedAt, REPORT_LOCALE)}:`,
    `- typ: ${formatTransactionType(transaction.transactionType, cs.transactionType)}`,
    `- částka: ${amount} (v CZK: ${amountCzk})`,
    `- trasa: ${transaction.payerCountry || NOT_KNOWN} → ${transaction.payeeCountry || NOT_KNOWN}`,
    `- účet plátce: ${transaction.payerAccount || NOT_KNOWN}, účet příjemce: ${transaction.payeeAccount || NOT_KNOWN}`,
  ].join("\n");
}

function describeClient({ client }: FauReportSource): string {
  return [
    `Klient ${client.id} (pseudonymní ID):`,
    `- země: ${client.country || NOT_KNOWN}`,
    `- rizikový profil: ${cs.riskProfile[client.riskProfile]}`,
    `- PEP: ${client.isPep ? "ano" : "ne"}`,
  ].join("\n");
}

function describeFailedRule(rule: FauReportSourceRule): string {
  const legalBasis = rule.legalBases.length > 0 ? rule.legalBases.join("; ") : NOT_KNOWN;
  const reasons = rule.reasons.length > 0 ? rule.reasons.join("; ") : NOT_KNOWN;
  return [
    `- ${rule.ruleName} (v${rule.ruleVersionNumber}), upravené skóre ${rule.adjustedScore}/100`,
    `  - důvod: ${reasons}`,
    `  - právní základ: ${legalBasis}`,
  ].join("\n");
}

function describeFailedRules({ failedRules }: FauReportSource): string {
  if (failedRules.length === 0) {
    return "Nesplněná pravidla: nejsou k dispozici, doplnit.";
  }
  return ["Nesplněná pravidla:", ...failedRules.map(describeFailedRule)].join("\n");
}

/**
 * Section V prefilled from a deterministic template. The backend will draft it with Bedrock (issue #20);
 * either way it is a proposal the person preparing the report rewrites or confirms.
 */
export function buildFauReportDescription(source: FauReportSource): string {
  return [
    describeTransaction(source),
    describeClient(source),
    describeFailedRules(source),
    "Související transakce klienta: doplnit z přehledu transakcí klienta.",
    "Čím je obchod podezřelý: doplnit závěr šetření.",
  ].join("\n\n");
}

/** A new draft with sections I to VI prefilled; the transaction of the dataset is booked, so it was executed. */
export function buildFauReportDraft({
  id,
  referenceNumber,
  source,
  reportingInstitution,
  author,
  now,
}: {
  id: string;
  referenceNumber: string;
  source: FauReportSource;
  reportingInstitution: ReportingInstitution;
  author: FauReportActor;
  now: string;
}): FauReport {
  return {
    id,
    referenceNumber,
    alert: source.alert,
    status: "draft",
    reportingInstitution,
    subject: {
      clientId: source.client.id,
      country: source.client.country,
      riskProfile: source.client.riskProfile,
      isPep: source.client.isPep,
      subjectType: null,
    },
    reportType: DEFAULT_FAU_REPORT_TYPE,
    description: buildFauReportDescription(source),
    execution: {
      status: "executed",
      note: `Obchod proveden ${formatDateTime(source.transaction.bookedAt, REPORT_LOCALE)}.`,
    },
    author,
    approvedBy: null,
    approvedAt: null,
    submission: null,
    alertRaisedAt: source.alertRaisedAt,
    createdAt: now,
    updatedAt: now,
    history: [{ action: "created", actor: author, at: now, reason: null }],
  };
}
