import type { DataSource } from "typeorm";

import type { AmlEvent } from "../../../domain/amlEvent";
import type {
  AmlEventCsvRow,
  AmlEventDetail,
  AmlEventFilter,
  AmlEventHit,
  AmlEventListItem,
  AmlEventReference,
  AmlEventTriageRecord,
  AmlEventTriageSummary,
  TriageLlmCall,
} from "../../../application/amlEvents/amlEventReadModels";
import type { AmlEventReadRepository } from "../../../application/amlEvents/amlEventReadRepository";
import type { Page, PageRequest } from "../../../application/pagination";
import { AmlEventEntity } from "../entities/AmlEventEntity";
import { AlertTriageLlmCallEntity } from "../entities/AlertTriageLlmCallEntity";
import { AmlEventHitEntity } from "../entities/AmlEventHitEntity";
import { AmlEventTriageEntity } from "../entities/AmlEventTriageEntity";
import { toClient } from "./clientMapping";
import { toRuleEvaluation } from "./evaluationRunMapping";
import { toTransaction } from "./transactionMapping";

const LIST_RUN_CSV_ROWS = `
  -- One row per AML event of a run with its current triage (the model's, else the rule-based one)
  SELECT e."alert_id" AS "alertId", e."alert_type" AS "alertType", e."client_id" AS "clientId",
         e."transaction_id" AS "transactionId", t."triage", t."priority", t."reason",
         CASE WHEN t."id" IS NULL THEN NULL
              ELSE t."log" || jsonb_build_object('llm_call_id', t."llm_call_id") END AS "log"
  FROM "aml_events" e
  LEFT JOIN LATERAL (
    SELECT * FROM "aml_event_triages" candidate
    WHERE candidate."aml_event_id" = e."id"
    ORDER BY candidate."source" = 'llm' DESC
    LIMIT 1
  ) t ON true
  WHERE e."run_id" = $1
  ORDER BY t."priority" DESC NULLS LAST, e."max_score" DESC, e."alert_id"
`;

export class TypeOrmAmlEventReadRepository implements AmlEventReadRepository {
  constructor(private readonly dataSource: DataSource) {}

  async listAmlEvents(filter: AmlEventFilter, page: PageRequest): Promise<Page<AmlEventListItem>> {
    const query = this.dataSource
      .getRepository(AmlEventEntity)
      .createQueryBuilder("event")
      .innerJoinAndSelect("event.rule", "rule")
      .leftJoin(
        AmlEventTriageEntity,
        "ruleTriage",
        "ruleTriage.amlEventId = event.id AND ruleTriage.source = 'rules'",
      )
      .where("event.runId = :runId", { runId: filter.runId });

    if (filter.alertType) {
      query.andWhere("event.alertType = :alertType", { alertType: filter.alertType });
    }

    if (filter.clientId) {
      query.andWhere("event.clientId = :clientId", { clientId: filter.clientId });
    }

    const [entities, total] = await query
      .orderBy("ruleTriage.priority", "DESC", "NULLS LAST")
      .addOrderBy("event.maxScore", "DESC")
      .addOrderBy("event.alertId", "ASC")
      .offset(page.offset)
      .limit(page.limit)
      .getManyAndCount();
    const triages = await this.loadCurrentTriages(entities.map(({ id }) => id));
    const items = entities.map((entity) => ({
      ...toAmlEvent(entity),
      ruleCode: entity.rule.code,
      triage: triages.get(entity.id) ?? null,
    }));

    return { ...page, items, total };
  }

  async findAmlEventDetail(amlEventId: string): Promise<AmlEventDetail | null> {
    const entity = await this.dataSource.getRepository(AmlEventEntity).findOne({
      where: { id: amlEventId },
      relations: { rule: true, ruleVersion: true, client: true },
    });

    if (!entity) {
      return null;
    }

    const [hits, otherClientAmlEvents, triageHistory] = await Promise.all([
      this.loadHits(amlEventId),
      this.loadOtherClientAmlEvents(entity),
      this.loadTriageHistory(amlEventId),
    ]);
    const { rule, ruleVersion } = entity;
    const currentTriage = findCurrentTriage(triageHistory);

    return {
      amlEvent: toAmlEvent(entity),
      rule: { id: rule.id, code: rule.code, alertType: rule.alertType, kind: rule.kind },
      ruleVersion: {
        id: ruleVersion.id,
        versionNo: ruleVersion.versionNo,
        humanText: ruleVersion.humanText,
        escalationRole: ruleVersion.escalationRole,
      },
      client: toClient(entity.client),
      hits,
      otherClientAmlEvents,
      triage: currentTriage ? toTriageSummary(currentTriage) : null,
      triageHistory,
      triageLlmCall: await this.loadLlmCall(currentTriage?.llmCallId ?? null),
    };
  }

  listRunCsvRows(runId: string): Promise<AmlEventCsvRow[]> {
    return this.dataSource.query<AmlEventCsvRow[]>(LIST_RUN_CSV_ROWS, [runId]);
  }

  private async loadCurrentTriages(amlEventIds: string[]): Promise<Map<string, AmlEventTriageSummary>> {
    if (amlEventIds.length === 0) {
      return new Map();
    }

    const entities = await this.dataSource
      .getRepository(AmlEventTriageEntity)
      .createQueryBuilder("triage")
      .where("triage.amlEventId IN (:...amlEventIds)", { amlEventIds })
      .getMany();
    const triagesByEvent = new Map<string, AmlEventTriageEntity[]>();

    for (const triageEntity of entities) {
      triagesByEvent.set(triageEntity.amlEventId, [
        ...(triagesByEvent.get(triageEntity.amlEventId) ?? []),
        triageEntity,
      ]);
    }

    return new Map(
      [...triagesByEvent].flatMap(([amlEventId, eventTriages]) => {
        const current = findCurrentTriage(eventTriages);

        return current ? [[amlEventId, toTriageSummary(current)] as const] : [];
      }),
    );
  }

  private async loadTriageHistory(amlEventId: string): Promise<AmlEventTriageRecord[]> {
    const entities = await this.dataSource
      .getRepository(AmlEventTriageEntity)
      .find({ where: { amlEventId }, order: { createdAt: "ASC" } });

    return entities.map((entity) => ({
      ...toTriageSummary(entity),
      priorityFactors: entity.priorityFactors,
      log: entity.log,
      llmCallId: entity.llmCallId,
      createdAt: entity.createdAt,
    }));
  }

  private async loadLlmCall(llmCallId: string | null): Promise<TriageLlmCall | null> {
    if (!llmCallId) {
      return null;
    }

    const entity = await this.dataSource
      .getRepository(AlertTriageLlmCallEntity)
      .createQueryBuilder("call")
      .where("call.id = :llmCallId", { llmCallId })
      .getOne();

    return entity
      ? {
          id: entity.id,
          modelId: entity.modelId,
          systemPrompt: entity.systemPrompt,
          userPrompt: entity.userPrompt,
          response: entity.response,
          inputTokens: entity.inputTokens,
          outputTokens: entity.outputTokens,
          durationMs: entity.durationMs,
          createdAt: entity.createdAt,
        }
      : null;
  }

  private async loadHits(amlEventId: string): Promise<AmlEventHit[]> {
    const hitEntities = await this.dataSource.getRepository(AmlEventHitEntity).find({
      where: { amlEventId },
      relations: { ruleEvaluation: { transactionEvaluation: { transaction: true } } },
    });

    return hitEntities
      .map(({ ruleEvaluation }) => ({
        transaction: toTransaction(ruleEvaluation.transactionEvaluation.transaction),
        ruleEvaluation: toRuleEvaluation(ruleEvaluation),
      }))
      .sort(compareHitsChronologically);
  }

  private async loadOtherClientAmlEvents(entity: AmlEventEntity): Promise<AmlEventReference[]> {
    const otherEntities = await this.dataSource
      .getRepository(AmlEventEntity)
      .createQueryBuilder("event")
      .select(["event.id", "event.alertId", "event.alertType"])
      .where("event.runId = :runId AND event.clientId = :clientId AND event.id <> :id", {
        runId: entity.runId,
        clientId: entity.clientId,
        id: entity.id,
      })
      .orderBy("event.alertId", "ASC")
      .getMany();

    const triages = await this.loadCurrentTriages(otherEntities.map(({ id }) => id));

    return otherEntities.map(({ id, alertId, alertType }) => ({
      id,
      alertId,
      alertType,
      triage: triages.get(id) ?? null,
    }));
  }
}

function findCurrentTriage<T extends Pick<AmlEventTriageSummary, "source">>(triages: readonly T[]): T | null {
  return (
    triages.find(({ source }) => source === "llm") ?? triages.find(({ source }) => source === "rules") ?? null
  );
}

function toTriageSummary(triage: AmlEventTriageSummary): AmlEventTriageSummary {
  return { source: triage.source, triage: triage.triage, priority: triage.priority, reason: triage.reason };
}

function compareHitsChronologically(left: AmlEventHit, right: AmlEventHit): number {
  const timeOrder = left.transaction.occurredAt.getTime() - right.transaction.occurredAt.getTime();

  return timeOrder || left.transaction.transactionId.localeCompare(right.transaction.transactionId);
}

function toAmlEvent(entity: AmlEventEntity): AmlEvent {
  return {
    id: entity.id,
    alertId: entity.alertId,
    runId: entity.runId,
    ruleId: entity.ruleId,
    ruleVersionId: entity.ruleVersionId,
    alertType: entity.alertType,
    alertGranularity: entity.alertGranularity,
    clientId: entity.clientId,
    transactionId: entity.transactionId,
    periodMonth: entity.periodMonth,
    maxScore: entity.maxScore,
    hitCount: entity.hitCount,
    createdAt: entity.createdAt,
  };
}
