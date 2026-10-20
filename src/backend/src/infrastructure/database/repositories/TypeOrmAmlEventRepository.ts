import { randomUUID } from "node:crypto";

import type { DataSource, EntityManager } from "typeorm";

import type { NewAmlEvent, RuleHit } from "../../../domain/amlEvent";
import type { AmlEventRepository } from "../../../application/amlEvents/amlEventRepository";

const INSERT_CHUNK_SIZE = 10_000;

const LIST_RUN_RULE_HITS = `
  -- Stored hits of one run with the rule fields that group them into AML events
  SELECT re."id" AS "ruleEvaluationId", rv."rule_id" AS "ruleId", re."rule_version_id" AS "ruleVersionId",
         r."code" AS "ruleCode", r."alert_type" AS "alertType", r."alert_granularity" AS "alertGranularity",
         te."client_id" AS "clientId", te."transaction_id" AS "transactionId", t."ts" AS "occurredAt",
         re."adjusted_score" AS "adjustedScore"
  FROM "transaction_evaluations" te
  JOIN "rule_evaluations" re ON re."transaction_evaluation_id" = te."id"
  JOIN "rule_versions" rv ON rv."id" = re."rule_version_id"
  JOIN "rules" r ON r."id" = rv."rule_id"
  JOIN "transactions" t ON t."transaction_id" = te."transaction_id"
  WHERE te."run_id" = $1 AND re."outcome" = 'hit'
`;

const INSERT_AML_EVENTS = `
  -- AML events of one run
  INSERT INTO "aml_events" (
    "id", "run_id", "alert_id", "rule_id", "rule_version_id", "alert_type", "alert_granularity", "client_id",
    "transaction_id", "period_month", "max_score", "hit_count"
  )
  SELECT batch."id", $1, batch."alert_id", batch."rule_id", batch."rule_version_id", batch."alert_type",
         batch."alert_granularity", batch."client_id", batch."transaction_id", batch."period_month",
         batch."max_score", batch."hit_count"
  FROM unnest($2::uuid[], $3::text[], $4::uuid[], $5::uuid[], $6::text[], $7::text[], $8::text[], $9::text[],
              $10::text[], $11::int[], $12::int[])
    AS batch("id", "alert_id", "rule_id", "rule_version_id", "alert_type", "alert_granularity", "client_id",
             "transaction_id", "period_month", "max_score", "hit_count")
`;

const INSERT_AML_EVENT_HITS = `
  -- Links of AML events to the rule hits they were grouped from
  INSERT INTO "aml_event_hits" ("aml_event_id", "rule_evaluation_id")
  SELECT * FROM unnest($1::uuid[], $2::uuid[])
`;

type AmlEventWithId = NewAmlEvent & { id: string };
type AmlEventHitLink = { amlEventId: string; ruleEvaluationId: string };

export class TypeOrmAmlEventRepository implements AmlEventRepository {
  constructor(private readonly dataSource: DataSource) {}

  listRunRuleHits(runId: string): Promise<RuleHit[]> {
    return this.dataSource.query<RuleHit[]>(LIST_RUN_RULE_HITS, [runId]);
  }

  createAmlEvents(input: { runId: string; amlEvents: NewAmlEvent[] }): Promise<void> {
    const amlEventsWithIds = input.amlEvents.map((amlEvent) => ({ ...amlEvent, id: randomUUID() }));
    const hitLinks = amlEventsWithIds.flatMap((amlEvent) =>
      amlEvent.ruleEvaluationIds.map((ruleEvaluationId) => ({ amlEventId: amlEvent.id, ruleEvaluationId })),
    );

    return this.dataSource.transaction(async (manager) => {
      for (const chunk of splitIntoChunks(amlEventsWithIds)) {
        await insertAmlEvents(manager, input.runId, chunk);
      }

      for (const chunk of splitIntoChunks(hitLinks)) {
        await insertAmlEventHits(manager, chunk);
      }
    });
  }
}

async function insertAmlEvents(manager: EntityManager, runId: string, amlEvents: AmlEventWithId[]) {
  await manager.query(INSERT_AML_EVENTS, [
    runId,
    amlEvents.map((amlEvent) => amlEvent.id),
    amlEvents.map((amlEvent) => amlEvent.alertId),
    amlEvents.map((amlEvent) => amlEvent.ruleId),
    amlEvents.map((amlEvent) => amlEvent.ruleVersionId),
    amlEvents.map((amlEvent) => amlEvent.alertType),
    amlEvents.map((amlEvent) => amlEvent.alertGranularity),
    amlEvents.map((amlEvent) => amlEvent.clientId),
    amlEvents.map((amlEvent) => amlEvent.transactionId),
    amlEvents.map((amlEvent) => amlEvent.periodMonth),
    amlEvents.map((amlEvent) => amlEvent.maxScore),
    amlEvents.map((amlEvent) => amlEvent.ruleEvaluationIds.length),
  ]);
}

async function insertAmlEventHits(manager: EntityManager, hitLinks: AmlEventHitLink[]) {
  await manager.query(INSERT_AML_EVENT_HITS, [
    hitLinks.map((hitLink) => hitLink.amlEventId),
    hitLinks.map((hitLink) => hitLink.ruleEvaluationId),
  ]);
}

function splitIntoChunks<T>(items: readonly T[]): T[][] {
  const chunks: T[][] = [];

  for (let offset = 0; offset < items.length; offset += INSERT_CHUNK_SIZE) {
    chunks.push(items.slice(offset, offset + INSERT_CHUNK_SIZE));
  }

  return chunks;
}
