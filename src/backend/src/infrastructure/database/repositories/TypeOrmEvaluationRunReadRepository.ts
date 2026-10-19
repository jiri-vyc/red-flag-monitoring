import { type DataSource, type FindOptionsSelect, In } from "typeorm";

import type { Client } from "../../../domain/client";
import {
  type RuleEvaluation,
  type TransactionEvaluation,
  type Verdict,
  VERDICTS,
} from "../../../domain/evaluation";
import type { Transaction } from "../../../domain/transaction";
import type {
  EvaluationRunListItem,
  EvaluationRunSummary,
  HitRuleSummary,
  LegalBasisDetail,
  RuleEvaluationDetail,
  RunReferenceListVersionSummary,
  RunRuleVersionSummary,
  TransactionEvaluationDetail,
  TransactionEvaluationFilter,
  TransactionEvaluationListItem,
} from "../../../application/evaluationRuns/evaluationRunReadModels";
import type { EvaluationRunReadRepository } from "../../../application/evaluationRuns/evaluationRunReadRepository";
import type { Page, PageRequest } from "../../../application/pagination";
import type { ClientEntity } from "../entities/ClientEntity";
import { EvaluationRunEntity } from "../entities/EvaluationRunEntity";
import { RuleEvaluationEntity } from "../entities/RuleEvaluationEntity";
import { RuleLegalBasisEntity } from "../entities/RuleLegalBasisEntity";
import type { TransactionEntity } from "../entities/TransactionEntity";
import { TransactionEvaluationEntity } from "../entities/TransactionEvaluationEntity";
import { toEvaluationRun, toEvaluationRunListItem } from "./evaluationRunMapping";

const COUNT_VERDICTS = `
  -- Number of evaluated transactions per verdict in one run
  SELECT "verdict", count(*)::int AS "count"
  FROM "transaction_evaluations"
  WHERE "run_id" = $1
  GROUP BY "verdict"
`;

const LIST_RUN_RULE_VERSIONS = `
  -- Rule versions fixed for the run (V5) with the number of hits each produced
  SELECT rv."id" AS "ruleVersionId", rv."rule_id" AS "ruleId", r."code" AS "ruleCode",
         r."alert_type" AS "alertType", rv."version_no" AS "versionNo",
         coalesce(hits."hitCount", 0)::int AS "hitCount",
         coalesce(hits."hitClientCount", 0)::int AS "hitClientCount"
  FROM "run_rule_versions" rrv
  JOIN "rule_versions" rv ON rv."id" = rrv."rule_version_id"
  JOIN "rules" r ON r."id" = rv."rule_id"
  LEFT JOIN (
    SELECT re."rule_version_id", count(*) AS "hitCount", count(DISTINCT te."client_id") AS "hitClientCount"
    FROM "rule_evaluations" re
    JOIN "transaction_evaluations" te ON te."id" = re."transaction_evaluation_id"
    WHERE te."run_id" = $1 AND re."outcome" = 'hit'
    GROUP BY re."rule_version_id"
  ) hits ON hits."rule_version_id" = rv."id"
  WHERE rrv."run_id" = $1
  ORDER BY r."code"
`;

const COUNT_FLAGGED_CLIENTS = `
  -- Number of distinct clients with at least one flagged transaction in one run
  SELECT count(DISTINCT "client_id")::int AS "count"
  FROM "transaction_evaluations"
  WHERE "run_id" = $1 AND "verdict" = 'flagged'
`;

const LIST_HIT_RULES = `
  -- Rules that hit the listed transaction evaluations, highest score first
  SELECT re."transaction_evaluation_id" AS "transactionEvaluationId", re."rule_version_id" AS "ruleVersionId",
         r."code" AS "ruleCode", r."alert_type" AS "alertType", re."adjusted_score" AS "adjustedScore"
  FROM "rule_evaluations" re
  JOIN "rule_versions" rv ON rv."id" = re."rule_version_id"
  JOIN "rules" r ON r."id" = rv."rule_id"
  WHERE re."transaction_evaluation_id" = ANY($1::uuid[]) AND re."outcome" = 'hit'
  ORDER BY re."adjusted_score" DESC, r."code"
`;

const LIST_RUN_REFERENCE_LIST_VERSIONS = `
  -- Reference list versions fixed for the run (V5)
  SELECT lv."id" AS "listVersionId", lv."list_id" AS "listId", l."code" AS "listCode",
         lv."version_no" AS "versionNo"
  FROM "run_reference_list_versions" rlv
  JOIN "reference_list_versions" lv ON lv."id" = rlv."list_version_id"
  JOIN "reference_lists" l ON l."id" = lv."list_id"
  WHERE rlv."run_id" = $1
  ORDER BY l."code"
`;

const RUN_LIST_COLUMNS: FindOptionsSelect<EvaluationRunEntity> = {
  id: true,
  status: true,
  scope: true,
  fileName: true,
  fileSha256: true,
  rowsTotal: true,
  rowsImported: true,
  rowsRejected: true,
  hitThreshold: true,
  engineVersion: true,
  txProcessed: true,
  txPassed: true,
  txFlagged: true,
  txError: true,
  createdBy: true,
  createdAt: true,
  finishedAt: true,
  errorMessage: true,
};

// Explicit columns keep policy bodies and regulation full texts out of the transaction detail.
const RULE_EVALUATION_DETAIL_COLUMNS: FindOptionsSelect<RuleEvaluationEntity> = {
  id: true,
  transactionEvaluationId: true,
  ruleVersionId: true,
  outcome: true,
  skipReason: true,
  rawScore: true,
  adjustedScore: true,
  features: true,
  trace: true,
  contextRefs: true,
  llmPrompt: true,
  llmResponse: true,
  llmModelId: true,
  errorMessage: true,
  ruleVersion: {
    id: true,
    versionNo: true,
    humanText: true,
    baseScore: true,
    sensitivity: true,
    rule: { id: true, code: true, alertType: true, kind: true },
    derivedFromPolicyVersion: { id: true, versionNo: true, policy: { id: true, code: true } },
  },
};

const LEGAL_BASIS_DETAIL_COLUMNS: FindOptionsSelect<RuleLegalBasisEntity> = {
  id: true,
  ruleVersionId: true,
  ref: true,
  regulationVersion: { id: true, label: true, regulation: { id: true, code: true, title: true } },
};

export class TypeOrmEvaluationRunReadRepository implements EvaluationRunReadRepository {
  constructor(private readonly dataSource: DataSource) {}

  hasRun(runId: string): Promise<boolean> {
    return this.dataSource.getRepository(EvaluationRunEntity).existsBy({ id: runId });
  }

  async listRuns(page: PageRequest): Promise<Page<EvaluationRunListItem>> {
    const [entities, total] = await this.dataSource.getRepository(EvaluationRunEntity).findAndCount({
      select: RUN_LIST_COLUMNS,
      order: { createdAt: "DESC" },
      skip: page.offset,
      take: page.limit,
    });

    return { ...page, items: entities.map(toEvaluationRunListItem), total };
  }

  async findRunSummary(runId: string): Promise<EvaluationRunSummary | null> {
    const entity = await this.dataSource.getRepository(EvaluationRunEntity).findOneBy({ id: runId });

    if (!entity) {
      return null;
    }

    const [verdictRows, flaggedClientRows, ruleVersions, referenceListVersions] = await Promise.all([
      this.dataSource.query<{ verdict: Verdict; count: number }[]>(COUNT_VERDICTS, [runId]),
      this.dataSource.query<{ count: number }[]>(COUNT_FLAGGED_CLIENTS, [runId]),
      this.dataSource.query<RunRuleVersionSummary[]>(LIST_RUN_RULE_VERSIONS, [runId]),
      this.dataSource.query<RunReferenceListVersionSummary[]>(LIST_RUN_REFERENCE_LIST_VERSIONS, [runId]),
    ]);

    return {
      run: toEvaluationRun(entity),
      verdictCounts: toVerdictCounts(verdictRows),
      flaggedClientCount: flaggedClientRows[0]?.count ?? 0,
      ruleVersions,
      referenceListVersions,
    };
  }

  async listTransactionEvaluations(
    filter: TransactionEvaluationFilter,
    page: PageRequest,
  ): Promise<Page<TransactionEvaluationListItem>> {
    const query = this.dataSource
      .getRepository(TransactionEvaluationEntity)
      .createQueryBuilder("te")
      .innerJoinAndSelect("te.transaction", "tx")
      .where("te.runId = :runId", { runId: filter.runId });

    if (filter.verdict) {
      query.andWhere("te.verdict = :verdict", { verdict: filter.verdict });
    }

    if (filter.hitRuleVersionId) {
      query.andWhere(
        `EXISTS (SELECT 1 FROM "rule_evaluations" re WHERE re."transaction_evaluation_id" = te."id"
          AND re."rule_version_id" = :ruleVersionId AND re."outcome" = 'hit')`,
        { ruleVersionId: filter.hitRuleVersionId },
      );
    }

    const [entities, total] = await query
      .orderBy("te.maxScore", "DESC")
      .addOrderBy("te.sourceRowNo", "ASC")
      .offset(page.offset)
      .limit(page.limit)
      .getManyAndCount();
    const hitRulesByEvaluationId = await this.loadHitRules(entities.map((entity) => entity.id));
    const items = entities.map((entity) => ({
      ...toTransactionEvaluation(entity),
      transaction: toTransaction(entity.transaction),
      hitRules: hitRulesByEvaluationId.get(entity.id) ?? [],
    }));

    return { ...page, items, total };
  }

  async findTransactionEvaluationDetail(
    runId: string,
    transactionId: string,
  ): Promise<TransactionEvaluationDetail | null> {
    const evaluation = await this.dataSource.getRepository(TransactionEvaluationEntity).findOne({
      where: { runId, transactionId },
      relations: { transaction: true, client: true },
    });

    if (!evaluation) {
      return null;
    }

    return {
      evaluation: toTransactionEvaluation(evaluation),
      transaction: toTransaction(evaluation.transaction),
      client: toClient(evaluation.client),
      ruleEvaluations: await this.loadRuleEvaluationDetails(evaluation.id),
    };
  }

  private async loadHitRules(transactionEvaluationIds: string[]): Promise<Map<string, HitRuleSummary[]>> {
    const rows = await this.dataSource.query<(HitRuleSummary & { transactionEvaluationId: string })[]>(
      LIST_HIT_RULES,
      [transactionEvaluationIds],
    );
    const hitRulesByEvaluationId = new Map<string, HitRuleSummary[]>();

    for (const { transactionEvaluationId, ...hitRule } of rows) {
      const hitRules = hitRulesByEvaluationId.get(transactionEvaluationId) ?? [];
      hitRules.push(hitRule);
      hitRulesByEvaluationId.set(transactionEvaluationId, hitRules);
    }

    return hitRulesByEvaluationId;
  }

  // "Cesta k regulaci" from spec/datovy-model.md, extended to every outcome so the UI shows all rules.
  private async loadRuleEvaluationDetails(transactionEvaluationId: string): Promise<RuleEvaluationDetail[]> {
    const ruleEvaluations = await this.dataSource.getRepository(RuleEvaluationEntity).find({
      where: { transactionEvaluationId },
      relations: { ruleVersion: { rule: true, derivedFromPolicyVersion: { policy: true } } },
      select: RULE_EVALUATION_DETAIL_COLUMNS,
    });
    const legalBases = await this.dataSource.getRepository(RuleLegalBasisEntity).find({
      where: { ruleVersionId: In(ruleEvaluations.map((ruleEvaluation) => ruleEvaluation.ruleVersionId)) },
      relations: { regulationVersion: { regulation: true } },
      select: LEGAL_BASIS_DETAIL_COLUMNS,
      order: { ref: "ASC" },
    });

    return ruleEvaluations
      .map((ruleEvaluation) =>
        toRuleEvaluationDetail(
          ruleEvaluation,
          legalBases.filter((legalBasis) => legalBasis.ruleVersionId === ruleEvaluation.ruleVersionId),
        ),
      )
      .sort(compareByRelevance);
  }
}

// Hits first, then by score, so the reason a transaction was flagged is at the top.
function compareByRelevance(left: RuleEvaluationDetail, right: RuleEvaluationDetail): number {
  const hitOrder = Number(right.outcome === "hit") - Number(left.outcome === "hit");
  const scoreOrder = (right.adjustedScore ?? -1) - (left.adjustedScore ?? -1);

  return hitOrder || scoreOrder || left.rule.code.localeCompare(right.rule.code);
}

function toVerdictCounts(rows: { verdict: Verdict; count: number }[]): Record<Verdict, number> {
  const counts = Object.fromEntries(VERDICTS.map((verdict) => [verdict, 0])) as Record<Verdict, number>;

  for (const row of rows) {
    counts[row.verdict] = row.count;
  }

  return counts;
}

function toTransactionEvaluation(entity: TransactionEvaluationEntity): TransactionEvaluation {
  return {
    id: entity.id,
    runId: entity.runId,
    transactionId: entity.transactionId,
    clientId: entity.clientId,
    sourceRowNo: entity.sourceRowNo,
    clientRiskProfile: entity.clientRiskProfile,
    verdict: entity.verdict,
    maxScore: entity.maxScore,
    hitCount: entity.hitCount,
    evaluatedAt: entity.evaluatedAt,
  };
}

function toTransaction(entity: TransactionEntity): Transaction {
  return {
    transactionId: entity.transactionId,
    clientId: entity.clientId,
    occurredAt: entity.occurredAt,
    amount: entity.amount,
    currency: entity.currency,
    payerCountry: entity.payerCountry,
    payeeCountry: entity.payeeCountry,
    payerAccount: entity.payerAccount,
    payeeAccount: entity.payeeAccount,
    transactionType: entity.transactionType,
    counterpartyAccount: entity.counterpartyAccount,
    counterpartyCountry: entity.counterpartyCountry,
  };
}

function toClient(entity: ClientEntity): Client {
  return {
    clientId: entity.clientId,
    country: entity.country,
    contractDate: entity.contractDate,
    contractChannel: entity.contractChannel,
    isPep: entity.isPep,
    clientType: entity.clientType,
    projectedMonthlyVolumeCzk: entity.projectedMonthlyVolumeCzk,
    projectedMonthlyTxCount: entity.projectedMonthlyTxCount,
    q2VolumeCzk: entity.q2VolumeCzk,
    q2TxCount: entity.q2TxCount,
    q2MaxTxCzk: entity.q2MaxTxCzk,
    amlRiskScore: entity.amlRiskScore,
  };
}

function toRuleEvaluation(entity: RuleEvaluationEntity): RuleEvaluation {
  return {
    id: entity.id,
    transactionEvaluationId: entity.transactionEvaluationId,
    ruleVersionId: entity.ruleVersionId,
    outcome: entity.outcome,
    skipReason: entity.skipReason,
    rawScore: entity.rawScore,
    adjustedScore: entity.adjustedScore,
    features: entity.features,
    trace: entity.trace,
    contextRefs: entity.contextRefs,
    llmPrompt: entity.llmPrompt,
    llmResponse: entity.llmResponse,
    llmModelId: entity.llmModelId,
    errorMessage: entity.errorMessage,
  };
}

function toRuleEvaluationDetail(
  entity: RuleEvaluationEntity,
  legalBases: RuleLegalBasisEntity[],
): RuleEvaluationDetail {
  const { ruleVersion } = entity;
  const { rule, derivedFromPolicyVersion } = ruleVersion;

  return {
    ...toRuleEvaluation(entity),
    rule: { id: rule.id, code: rule.code, alertType: rule.alertType, kind: rule.kind },
    ruleVersion: {
      versionNo: ruleVersion.versionNo,
      humanText: ruleVersion.humanText,
      baseScore: ruleVersion.baseScore,
      sensitivity: ruleVersion.sensitivity,
    },
    legalBases: legalBases.map(toLegalBasisDetail),
    derivedFromPolicyVersion: derivedFromPolicyVersion
      ? {
          policyId: derivedFromPolicyVersion.policy.id,
          policyCode: derivedFromPolicyVersion.policy.code,
          policyVersionId: derivedFromPolicyVersion.id,
          policyVersionNo: derivedFromPolicyVersion.versionNo,
        }
      : null,
  };
}

function toLegalBasisDetail(entity: RuleLegalBasisEntity): LegalBasisDetail {
  const { regulationVersion } = entity;

  return {
    regulationId: regulationVersion.regulation.id,
    regulationCode: regulationVersion.regulation.code,
    regulationTitle: regulationVersion.regulation.title,
    regulationVersionId: regulationVersion.id,
    regulationVersionLabel: regulationVersion.label,
    ref: entity.ref,
  };
}
