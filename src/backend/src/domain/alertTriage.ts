import type { Client } from "./client";
import { calculateFullMonthsBetween } from "./features/calendar";
import type { PricedTransaction } from "./features/pricedTransaction";

export const TRIAGE_DECISIONS = ["FP", "REVIEW"] as const;
export type TriageDecision = (typeof TRIAGE_DECISIONS)[number];

export const TRIAGE_SOURCES = ["rules", "llm"] as const;
export type TriageSource = (typeof TRIAGE_SOURCES)[number];

export const MAX_PRIORITY = 100;
// SVZ-03 čl. 8.3 bod 4: from this priority an alert cannot be closed as FP without an individual human review.
export const INDIVIDUAL_REVIEW_PRIORITY = 40;

// SVZ-03 Příloha 1, tabulka P, and SVZ-06 čl. 5–15 ("Priorita (základ)"). Weights need compliance review.
export const RULE_PRIORITY_BASES: Readonly<Record<string, number>> = {
  "R-01": 15,
  "R-02": 60,
  "R-03": 60,
  "R-04": 55,
  "R-05": 35,
  "R-06": 35,
  "R-07": 40,
  "R-08": 30,
  "R-09": 30,
  "R-10": 35,
  "R-11": 50,
  "R-12": 40,
  "R-13": 25,
  "R-14": 40,
  "R-15": 35,
  "R-16": 70,
  "R-17": 30,
};

export const PRIORITY_WEIGHTS = {
  amlRiskHigh: 20,
  amlRiskMedium: 10,
  pep: 15,
  highRiskJurisdiction: 15,
  distantContract: 5,
  shortRelationship: 5,
  additionalScenario: 10,
  allConditionsMet: 10,
  volumeOverProjection: 10,
} as const;

const SHORT_RELATIONSHIP_MONTHS = 12;
const VOLUME_OVER_PROJECTION_MULTIPLE = 5;
const Q2_MONTHS = 3;
const CONSISTENT_VOLUME_MULTIPLE = 2;
// Tabulka P grants the all-conditions bonus to R-01 only, although R-13 and R-16 also have `any` conditions.
const ALL_CONDITIONS_BONUS_RULE_CODES: ReadonlySet<string> = new Set(["R-01"]);

// R-02 to R-05 always need the background and purpose of the trade examined (SVZ-03 čl. 8.6), R-09 and R-16
// cannot be closed without an individual review (SVZ-06 čl. 17).
export const MANDATORY_REVIEW_RULE_CODES: ReadonlySet<string> = new Set([
  "R-02",
  "R-03",
  "R-04",
  "R-05",
  "R-09",
  "R-16",
]);

export type PriorityFactor = { code: string; label: string; points: number };
export type AlertPriority = { priority: number; factors: PriorityFactor[] };

export type TriageAlertHit = {
  transactionId: string;
  occurredAt: Date;
  amountCzk: number;
  transactionType: string;
  payerCountry: string;
  payeeCountry: string;
  metConditionIds: string[];
  traceSummary: string | null;
};

export type TriageAlert = {
  amlEventId: string;
  alertId: string;
  ruleCode: string;
  ruleVersionId: string;
  ruleText: string;
  alertType: string;
  transactionId: string | null;
  periodMonth: string;
  maxScore: number;
  // Top-level conditions of a rule with `any` logic; 0 otherwise.
  anyConditionCount: number;
  hits: TriageAlertHit[];
};

export type ClientMonthActivity = { volumeCzk: number; txCount: number; maxTxCzk: number };

export type ClientTriageCase = {
  client: Client;
  alerts: TriageAlert[];
  activityByMonth: ReadonlyMap<string, ClientMonthActivity>;
  highRiskCountries: ReadonlySet<string>;
};

export type GuardrailReason = "mandatory_review_rule" | "pep_client" | "high_risk_jurisdiction";

export type TriageProposal = {
  amlEventId: string;
  triage: TriageDecision;
  priority: AlertPriority;
  reason: string;
  guardrails: GuardrailReason[];
};

export function summarizeClientMonths(
  transactions: readonly PricedTransaction[],
): Map<string, ClientMonthActivity> {
  const activityByMonth = new Map<string, ClientMonthActivity>();

  for (const transaction of transactions) {
    const activity = activityByMonth.get(transaction.monthKey) ?? { volumeCzk: 0, txCount: 0, maxTxCzk: 0 };

    activity.volumeCzk += transaction.amountCzk;
    activity.txCount += 1;
    activity.maxTxCzk = Math.max(activity.maxTxCzk, transaction.amountCzk);
    activityByMonth.set(transaction.monthKey, activity);
  }

  return activityByMonth;
}

export function calculateAlertPriority(triageCase: ClientTriageCase, alert: TriageAlert): AlertPriority {
  const { client } = triageCase;
  const periodAlerts = triageCase.alerts.filter(({ periodMonth }) => periodMonth === alert.periodMonth);
  const factors: PriorityFactor[] = [
    createBaseFactor(alert, periodAlerts),
    ...createClientFactors(client, alert.periodMonth),
  ];

  if (isHighRiskJurisdictionInvolved(triageCase, alert)) {
    factors.push({
      code: "high_risk_jurisdiction",
      label: "Client or counterparty from a high-risk jurisdiction",
      points: PRIORITY_WEIGHTS.highRiskJurisdiction,
    });
  }

  const otherScenarioCount = new Set(periodAlerts.map(({ ruleCode }) => ruleCode)).size - 1;

  if (otherScenarioCount > 0) {
    factors.push({
      code: "additional_scenarios",
      label: `${otherScenarioCount} other scenario(s) on the client in ${alert.periodMonth}`,
      points: otherScenarioCount * PRIORITY_WEIGHTS.additionalScenario,
    });
  }

  if (areAllConditionsMet(alert)) {
    factors.push({
      code: "all_conditions_met",
      label: `All ${alert.anyConditionCount} conditions of ${alert.ruleCode} met`,
      points: PRIORITY_WEIGHTS.allConditionsMet,
    });
  }

  const volumeMultiple = calculateVolumeToProjectionMultiple(triageCase, alert.periodMonth);

  if (volumeMultiple !== null && volumeMultiple > VOLUME_OVER_PROJECTION_MULTIPLE) {
    factors.push({
      code: "volume_over_projection",
      label: `Month volume ${formatMultiple(volumeMultiple)} the projected monthly volume`,
      points: PRIORITY_WEIGHTS.volumeOverProjection,
    });
  }

  const total = factors.reduce((sum, factor) => sum + factor.points, 0);

  return { priority: Math.min(Math.max(total, 0), MAX_PRIORITY), factors };
}

export function findGuardrails(triageCase: ClientTriageCase, alert: TriageAlert): GuardrailReason[] {
  const guardrails: GuardrailReason[] = [];

  if (MANDATORY_REVIEW_RULE_CODES.has(alert.ruleCode)) {
    guardrails.push("mandatory_review_rule");
  }

  if (triageCase.client.isPep) {
    guardrails.push("pep_client");
  }

  if (isHighRiskJurisdictionInvolved(triageCase, alert)) {
    guardrails.push("high_risk_jurisdiction");
  }

  return guardrails;
}

// Priority does not decide triage: from 40 an FP stays a valid proposal that a human confirms individually.
export function proposeRuleBasedTriage(triageCase: ClientTriageCase): TriageProposal[] {
  return triageCase.alerts.map((alert) => {
    const priority = calculateAlertPriority(triageCase, alert);
    const guardrails = findGuardrails(triageCase, alert);
    const profile = describeProfileConsistency(triageCase, alert.periodMonth);
    const triage: TriageDecision = guardrails.length > 0 || !profile.isConsistent ? "REVIEW" : "FP";

    return {
      amlEventId: alert.amlEventId,
      triage,
      priority,
      reason: composeRuleBasedReason({ alert, triage, priority, guardrails, profile }),
      guardrails,
    };
  });
}

export type ProfileConsistency = {
  isConsistent: boolean;
  monthVolumeCzk: number;
  expectedMonthVolumeCzk: number;
  description: string;
};

// The expected month is the higher of the projection at contract conclusion and the Q2 2026 monthly average.
export function describeProfileConsistency(triageCase: ClientTriageCase, month: string): ProfileConsistency {
  const { client } = triageCase;
  const monthVolumeCzk = triageCase.activityByMonth.get(month)?.volumeCzk ?? 0;
  const projectedCzk = Number(client.projectedMonthlyVolumeCzk);
  const q2MonthlyCzk = Number(client.q2VolumeCzk) / Q2_MONTHS;
  const expectedMonthVolumeCzk = Math.max(projectedCzk, q2MonthlyCzk);
  const multiple = expectedMonthVolumeCzk > 0 ? monthVolumeCzk / expectedMonthVolumeCzk : Infinity;
  const isConsistent = multiple <= CONSISTENT_VOLUME_MULTIPLE;
  const comparison = Number.isFinite(multiple)
    ? `${formatMultiple(multiple)} the expected`
    : "with no expected";

  return {
    isConsistent,
    monthVolumeCzk,
    expectedMonthVolumeCzk,
    description:
      `${month} volume CZK ${formatCzk(monthVolumeCzk)} is ${comparison} month ` +
      `(CZK ${formatCzk(expectedMonthVolumeCzk)}: max of projection CZK ${formatCzk(projectedCzk)} ` +
      `and Q2 2026 monthly average CZK ${formatCzk(q2MonthlyCzk)})`,
  };
}

function createBaseFactor(alert: TriageAlert, periodAlerts: readonly TriageAlert[]): PriorityFactor {
  // Tabulka P: with several alerts on the client, the highest base counts.
  const strongestAlert = periodAlerts.reduce((strongest, candidate) =>
    findPriorityBase(candidate) > findPriorityBase(strongest) ? candidate : strongest,
  );
  const points = findPriorityBase(strongestAlert);
  const label =
    strongestAlert.ruleCode === alert.ruleCode
      ? `Scenario base ${alert.ruleCode}`
      : `Highest scenario base on the client: ${strongestAlert.ruleCode}`;

  return { code: "scenario_base", label, points };
}

// A rule outside the policy tables (e.g. from the wizard) takes its base from its score, the inverse of
// calculateBaseScore in rulePriority.ts.
function findPriorityBase(alert: TriageAlert): number {
  return RULE_PRIORITY_BASES[alert.ruleCode] ?? Math.max(0, (alert.maxScore - 50) * 2);
}

function createClientFactors(client: Client, periodMonth: string): PriorityFactor[] {
  const factors: PriorityFactor[] = [];

  if (client.amlRiskScore === "high") {
    factors.push({
      code: "aml_risk_score",
      label: "AML risk score high",
      points: PRIORITY_WEIGHTS.amlRiskHigh,
    });
  } else if (client.amlRiskScore === "medium") {
    factors.push({
      code: "aml_risk_score",
      label: "AML risk score medium",
      points: PRIORITY_WEIGHTS.amlRiskMedium,
    });
  }

  if (client.isPep) {
    factors.push({ code: "pep", label: "Politically exposed person", points: PRIORITY_WEIGHTS.pep });
  }

  if (client.contractChannel === "distant") {
    factors.push({
      code: "distant_contract",
      label: "Contract concluded at a distance",
      points: PRIORITY_WEIGHTS.distantContract,
    });
  }

  const relationshipMonths = calculateFullMonthsBetween(client.contractDate, `${periodMonth}-01`);

  if (relationshipMonths < SHORT_RELATIONSHIP_MONTHS) {
    factors.push({
      code: "short_relationship",
      label: `Relationship of ${Math.max(relationshipMonths, 0)} months (under ${SHORT_RELATIONSHIP_MONTHS})`,
      points: PRIORITY_WEIGHTS.shortRelationship,
    });
  }

  return factors;
}

function isHighRiskJurisdictionInvolved(triageCase: ClientTriageCase, alert: TriageAlert): boolean {
  const { highRiskCountries, client } = triageCase;

  return (
    highRiskCountries.has(client.country) ||
    alert.hits.some(
      (hit) => highRiskCountries.has(hit.payerCountry) || highRiskCountries.has(hit.payeeCountry),
    )
  );
}

function areAllConditionsMet(alert: TriageAlert): boolean {
  if (!ALL_CONDITIONS_BONUS_RULE_CODES.has(alert.ruleCode) || alert.anyConditionCount < 2) {
    return false;
  }

  const metConditionIds = new Set(alert.hits.flatMap((hit) => hit.metConditionIds));

  return metConditionIds.size >= alert.anyConditionCount;
}

function calculateVolumeToProjectionMultiple(triageCase: ClientTriageCase, month: string): number | null {
  const projectedCzk = Number(triageCase.client.projectedMonthlyVolumeCzk);
  const monthVolumeCzk = triageCase.activityByMonth.get(month)?.volumeCzk ?? 0;

  return projectedCzk > 0 ? monthVolumeCzk / projectedCzk : null;
}

const GUARDRAIL_DESCRIPTIONS: Record<GuardrailReason, string> = {
  mandatory_review_rule: "the scenario always needs a human review (SVZ-03 čl. 8.6, SVZ-06 čl. 17)",
  pep_client: "the client is a PEP (SVZ-03 čl. 8.4)",
  high_risk_jurisdiction: "a high-risk jurisdiction is involved",
};

export function applyGuardrails(
  proposal: TriageProposal,
  modelTriage: TriageDecision,
): { triage: TriageDecision; isOverridden: boolean } {
  const isOverridden = modelTriage === "FP" && proposal.guardrails.length > 0;

  return { triage: isOverridden ? "REVIEW" : modelTriage, isOverridden };
}

export function describeGuardrails(guardrails: readonly GuardrailReason[]): string {
  return guardrails.map((guardrail) => GUARDRAIL_DESCRIPTIONS[guardrail]).join("; ");
}

function composeRuleBasedReason(input: {
  alert: TriageAlert;
  triage: TriageDecision;
  priority: AlertPriority;
  guardrails: GuardrailReason[];
  profile: ProfileConsistency;
}): string {
  const { alert, triage, priority, guardrails, profile } = input;
  const hitSummary = `${alert.ruleCode} hit on ${alert.hits.length} transaction(s) in ${alert.periodMonth}.`;
  const factorSummary = priority.factors
    .map((factor) => `${factor.label} (${signed(factor.points)})`)
    .join(", ");
  const grounds = [hitSummary, `${profile.description}.`, `Priority ${priority.priority}: ${factorSummary}.`];

  if (guardrails.length > 0) {
    grounds.push(`REVIEW required because ${describeGuardrails(guardrails)}.`);
  } else if (triage === "REVIEW") {
    grounds.push("Activity is outside the client's expected range.");
  } else {
    grounds.push("Activity is consistent with the client's profile and history; no aggravating factor.");
  }

  if (triage === "FP" && priority.priority >= INDIVIDUAL_REVIEW_PRIORITY) {
    grounds.push(
      `Priority ${INDIVIDUAL_REVIEW_PRIORITY}+: a human must confirm the FP individually (SVZ-03 čl. 8.3).`,
    );
  }

  return grounds.join(" ");
}

function signed(points: number): string {
  return points >= 0 ? `+${points}` : String(points);
}

function formatMultiple(multiple: number): string {
  return `${multiple.toFixed(1)}×`;
}

export function formatCzk(amount: number): string {
  return Math.round(amount).toLocaleString("en-US");
}
