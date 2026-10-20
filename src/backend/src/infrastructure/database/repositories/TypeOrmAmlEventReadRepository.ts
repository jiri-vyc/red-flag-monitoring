import type { DataSource } from "typeorm";

import type { AmlEvent } from "../../../domain/amlEvent";
import type {
  AmlEventDetail,
  AmlEventFilter,
  AmlEventHit,
  AmlEventListItem,
  AmlEventReference,
} from "../../../application/amlEvents/amlEventReadModels";
import type { AmlEventReadRepository } from "../../../application/amlEvents/amlEventReadRepository";
import type { Page, PageRequest } from "../../../application/pagination";
import { AmlEventEntity } from "../entities/AmlEventEntity";
import { AmlEventHitEntity } from "../entities/AmlEventHitEntity";
import { toClient } from "./clientMapping";
import { toRuleEvaluation } from "./evaluationRunMapping";
import { toTransaction } from "./transactionMapping";

export class TypeOrmAmlEventReadRepository implements AmlEventReadRepository {
  constructor(private readonly dataSource: DataSource) {}

  async listAmlEvents(filter: AmlEventFilter, page: PageRequest): Promise<Page<AmlEventListItem>> {
    const query = this.dataSource
      .getRepository(AmlEventEntity)
      .createQueryBuilder("event")
      .innerJoinAndSelect("event.rule", "rule")
      .where("event.runId = :runId", { runId: filter.runId });

    if (filter.alertType) {
      query.andWhere("event.alertType = :alertType", { alertType: filter.alertType });
    }

    if (filter.clientId) {
      query.andWhere("event.clientId = :clientId", { clientId: filter.clientId });
    }

    const [entities, total] = await query
      .orderBy("event.maxScore", "DESC")
      .addOrderBy("event.alertId", "ASC")
      .offset(page.offset)
      .limit(page.limit)
      .getManyAndCount();
    const items = entities.map((entity) => ({ ...toAmlEvent(entity), ruleCode: entity.rule.code }));

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

    const [hits, otherClientAmlEvents] = await Promise.all([
      this.loadHits(amlEventId),
      this.loadOtherClientAmlEvents(entity),
    ]);
    const { rule, ruleVersion } = entity;

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
    };
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

    return otherEntities.map(({ id, alertId, alertType }) => ({ id, alertId, alertType }));
  }
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
