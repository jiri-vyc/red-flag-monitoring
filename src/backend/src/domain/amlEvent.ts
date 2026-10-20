import { toMonthKey } from "./features/calendar";
import type { AlertGranularity } from "./rule";

// A stored rule result with outcome `hit` of one run, with what grouping it into an AML event needs.
export type RuleHit = {
  ruleEvaluationId: string;
  ruleId: string;
  ruleVersionId: string;
  ruleCode: string;
  alertType: string;
  alertGranularity: AlertGranularity;
  clientId: string;
  transactionId: string;
  occurredAt: Date;
  adjustedScore: number;
};

// Issue #13: an AML event (alert) is one row of the mandatory CSV. `transactionId` is set for `transaction`
// granularity, `periodMonth` ("YYYY-MM") for `client_month`.
export type AmlEvent = {
  id: string;
  alertId: string;
  runId: string;
  ruleId: string;
  ruleVersionId: string;
  alertType: string;
  alertGranularity: AlertGranularity;
  clientId: string;
  transactionId: string | null;
  periodMonth: string | null;
  maxScore: number;
  hitCount: number;
  createdAt: Date;
};

export type NewAmlEvent = Omit<AmlEvent, "id" | "runId" | "hitCount" | "createdAt"> & {
  ruleEvaluationIds: string[];
};

export function groupRuleHitsIntoAmlEvents(hits: readonly RuleHit[]): NewAmlEvent[] {
  const amlEventsByAlertId = new Map<string, NewAmlEvent>();

  for (const hit of hits) {
    const groupedEvent = amlEventsByAlertId.get(createAlertId(hit));

    if (groupedEvent) {
      addHitToAmlEvent(groupedEvent, hit);
    } else {
      const newEvent = createAmlEventFromHit(hit);
      amlEventsByAlertId.set(newEvent.alertId, newEvent);
    }
  }

  return [...amlEventsByAlertId.values()].sort((left, right) => left.alertId.localeCompare(right.alertId));
}

function createAlertId(hit: RuleHit): string {
  if (hit.alertGranularity === "transaction") {
    return `${hit.ruleCode}-${hit.transactionId}`;
  }

  return `${hit.ruleCode}-${hit.clientId}-${toMonthKey(hit.occurredAt)}`;
}

function createAmlEventFromHit(hit: RuleHit): NewAmlEvent {
  const isTransactionEvent = hit.alertGranularity === "transaction";

  return {
    alertId: createAlertId(hit),
    ruleId: hit.ruleId,
    ruleVersionId: hit.ruleVersionId,
    alertType: hit.alertType,
    alertGranularity: hit.alertGranularity,
    clientId: hit.clientId,
    transactionId: isTransactionEvent ? hit.transactionId : null,
    periodMonth: isTransactionEvent ? null : toMonthKey(hit.occurredAt),
    maxScore: hit.adjustedScore,
    ruleEvaluationIds: [hit.ruleEvaluationId],
  };
}

function addHitToAmlEvent(amlEvent: NewAmlEvent, hit: RuleHit): void {
  amlEvent.maxScore = Math.max(amlEvent.maxScore, hit.adjustedScore);
  amlEvent.ruleEvaluationIds.push(hit.ruleEvaluationId);
}
