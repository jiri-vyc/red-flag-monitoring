import { randomUUID } from "node:crypto";

import type { DataSource, EntityManager } from "typeorm";

import type { EvaluationRun } from "../../../domain/evaluation";
import type { DeterministicRunRuleVersion, RunRuleSet } from "../../../domain/evaluateTransaction";
import type { RuleDefinition } from "../../../domain/ruleDefinition";
import type {
  EvaluationRunRepository,
  NewEvaluationRun,
  RunFailure,
  StoredTransactionEvaluation,
} from "../../../application/evaluationRuns/evaluationRunPorts";
import { EvaluationRunEntity } from "../entities/EvaluationRunEntity";
import { RunReferenceListVersionEntity } from "../entities/RunReferenceListVersionEntity";
import { RunRuleVersionEntity } from "../entities/RunRuleVersionEntity";
import { translateDatabaseErrors } from "../translateDatabaseErrors";
import { toEvaluationRun } from "./evaluationRunMapping";

const LIST_RUN_RULE_VERSIONS = `
  -- Rule versions fixed for the run (V5) with the rule fields the evaluation needs
  SELECT rv."id" AS "ruleVersionId", r."id" AS "ruleId", r."code" AS "ruleCode",
         r."whitelist_allowed" AS "isWhitelistAllowed", rv."definition", rv."base_score" AS "baseScore",
         rv."sensitivity", rv."risk_profiles" AS "riskProfiles"
  FROM "run_rule_versions" rrv
  JOIN "rule_versions" rv ON rv."id" = rrv."rule_version_id"
  JOIN "rules" r ON r."id" = rv."rule_id"
  WHERE rrv."run_id" = $1
  ORDER BY r."code"
`;

const LIST_RUN_REFERENCE_LISTS = `
  -- Items of the reference list versions fixed for the run (V5), by list code
  SELECT l."code", coalesce(array_agg(i."value" ORDER BY i."value") FILTER (WHERE i."value" IS NOT NULL), '{}') AS "items"
  FROM "run_reference_list_versions" rlv
  JOIN "reference_list_versions" lv ON lv."id" = rlv."list_version_id"
  JOIN "reference_lists" l ON l."id" = lv."list_id"
  LEFT JOIN "reference_list_items" i ON i."list_version_id" = lv."id"
  WHERE rlv."run_id" = $1
  GROUP BY l."code"
`;

const LIST_RUN_WHITELIST = `
  -- Current whitelist of the rules fixed for the run; the run takes it as of its execution
  SELECT DISTINCT w."rule_id" AS "ruleId", w."client_id" AS "clientId"
  FROM "whitelist_entries" w
  JOIN "rule_versions" rv ON rv."rule_id" = w."rule_id"
  JOIN "run_rule_versions" rrv ON rrv."rule_version_id" = rv."id"
  WHERE rrv."run_id" = $1
`;

const INSERT_TRANSACTION_EVALUATIONS = `
  -- One row per evaluated transaction of a batch
  INSERT INTO "transaction_evaluations" (
    "id", "run_id", "transaction_id", "client_id", "source_row_no", "client_risk_profile", "verdict",
    "max_score", "hit_count"
  )
  SELECT batch."id", $1, batch."transaction_id", batch."client_id", batch."source_row_no",
         batch."client_risk_profile", batch."verdict", batch."max_score", batch."hit_count"
  FROM unnest($2::uuid[], $3::text[], $4::text[], $5::int[], $6::text[], $7::text[], $8::int[], $9::int[])
    AS batch("id", "transaction_id", "client_id", "source_row_no", "client_risk_profile", "verdict",
             "max_score", "hit_count")
`;

// context_refs travel as jsonb arrays, because a text[][] parameter cannot hold rows of different lengths.
const INSERT_RULE_EVALUATIONS = `
  -- Rule results of the batch's flagged and error transactions
  INSERT INTO "rule_evaluations" (
    "transaction_evaluation_id", "rule_version_id", "outcome", "skip_reason", "raw_score", "adjusted_score",
    "features", "trace", "context_refs", "error_message"
  )
  SELECT batch."transaction_evaluation_id", batch."rule_version_id", batch."outcome", batch."skip_reason",
         batch."raw_score", batch."adjusted_score", batch."features", batch."trace",
         ARRAY(SELECT jsonb_array_elements_text(batch."context_refs")), batch."error_message"
  FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::text[], $5::int[], $6::int[], $7::jsonb[], $8::jsonb[],
              $9::jsonb[], $10::text[])
    AS batch("transaction_evaluation_id", "rule_version_id", "outcome", "skip_reason", "raw_score",
             "adjusted_score", "features", "trace", "context_refs", "error_message")
`;

const ADD_RUN_PROGRESS = `
  -- Progress counters of the run (V12)
  UPDATE "evaluation_runs"
  SET "tx_processed" = "tx_processed" + $2, "tx_passed" = "tx_passed" + $3,
      "tx_flagged" = "tx_flagged" + $4, "tx_error" = "tx_error" + $5
  WHERE "id" = $1
`;

type RunRuleVersionRow = Omit<DeterministicRunRuleVersion, "definition" | "baseScore"> & {
  definition: RuleDefinition | null;
  baseScore: number | null;
};

export class AgenticRuleNotSupportedError extends Error {}

export class TypeOrmEvaluationRunRepository implements EvaluationRunRepository {
  constructor(private readonly dataSource: DataSource) {}

  createRun(run: NewEvaluationRun): Promise<EvaluationRun> {
    return translateDatabaseErrors(() =>
      this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(
          manager.create(EvaluationRunEntity, {
            status: "running",
            scope: run.scope,
            fileName: run.fileName,
            fileSha256: run.fileSha256,
            rowsTotal: run.transactionCount,
            rowsImported: run.transactionCount,
            rowsRejected: 0,
            importErrors: [],
            hitThreshold: run.hitThreshold,
            engineVersion: run.engineVersion,
            txProcessed: 0,
            txPassed: 0,
            txFlagged: 0,
            txError: 0,
            createdBy: run.createdBy,
            finishedAt: null,
            errorMessage: null,
          }),
        );

        await insertFixedVersions(manager, saved.id, run);

        return toEvaluationRun(saved);
      }),
    );
  }

  async findRun(runId: string): Promise<EvaluationRun | null> {
    const entity = await this.dataSource.getRepository(EvaluationRunEntity).findOneBy({ id: runId });

    return entity ? toEvaluationRun(entity) : null;
  }

  async loadRunRuleSet(input: { runId: string; hitThreshold: number }): Promise<RunRuleSet> {
    const [ruleVersionRows, referenceListRows, whitelistRows] = await Promise.all([
      this.dataSource.query<RunRuleVersionRow[]>(LIST_RUN_RULE_VERSIONS, [input.runId]),
      this.dataSource.query<{ code: string; items: string[] }[]>(LIST_RUN_REFERENCE_LISTS, [input.runId]),
      this.dataSource.query<{ ruleId: string; clientId: string }[]>(LIST_RUN_WHITELIST, [input.runId]),
    ]);

    return {
      ruleVersions: ruleVersionRows.map(toDeterministicRunRuleVersion),
      referenceLists: new Map(referenceListRows.map((row) => [row.code, row.items])),
      whitelistedClientIdsByRuleId: groupWhitelistByRule(whitelistRows),
      hitThreshold: input.hitThreshold,
    };
  }

  appendTransactionEvaluations(input: {
    runId: string;
    evaluations: StoredTransactionEvaluation[];
  }): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const evaluationsWithIds = input.evaluations.map((evaluation) => ({ ...evaluation, id: randomUUID() }));

      await insertTransactionEvaluations(manager, input.runId, evaluationsWithIds);
      await insertRuleEvaluations(manager, evaluationsWithIds);
      await manager.query(ADD_RUN_PROGRESS, [
        input.runId,
        input.evaluations.length,
        countByVerdict(input.evaluations, "pass"),
        countByVerdict(input.evaluations, "flagged"),
        countByVerdict(input.evaluations, "error"),
      ]);
    });
  }

  async markRunCompleted(input: { runId: string; finishedAt: Date }): Promise<void> {
    await this.dataSource
      .getRepository(EvaluationRunEntity)
      .update({ id: input.runId, status: "running" }, { status: "completed", finishedAt: input.finishedAt });
  }

  async markRunFailed(failure: RunFailure): Promise<void> {
    await this.dataSource
      .getRepository(EvaluationRunEntity)
      .update(
        { id: failure.runId, status: "running" },
        { status: "failed", finishedAt: failure.finishedAt, errorMessage: failure.errorMessage },
      );
  }
}

async function insertFixedVersions(
  manager: EntityManager,
  runId: string,
  run: NewEvaluationRun,
): Promise<void> {
  await manager.insert(
    RunRuleVersionEntity,
    run.ruleVersionIds.map((ruleVersionId) => ({ runId, ruleVersionId })),
  );

  if (run.referenceListVersionIds.length > 0) {
    await manager.insert(
      RunReferenceListVersionEntity,
      run.referenceListVersionIds.map((listVersionId) => ({ runId, listVersionId })),
    );
  }
}

type StoredEvaluationWithId = StoredTransactionEvaluation & { id: string };

async function insertTransactionEvaluations(
  manager: EntityManager,
  runId: string,
  evaluations: StoredEvaluationWithId[],
): Promise<void> {
  await manager.query(INSERT_TRANSACTION_EVALUATIONS, [
    runId,
    evaluations.map((evaluation) => evaluation.id),
    evaluations.map((evaluation) => evaluation.transactionId),
    evaluations.map((evaluation) => evaluation.clientId),
    evaluations.map((evaluation) => evaluation.sourceRowNo),
    evaluations.map((evaluation) => evaluation.clientRiskProfile),
    evaluations.map((evaluation) => evaluation.verdict),
    evaluations.map((evaluation) => evaluation.maxScore),
    evaluations.map((evaluation) => evaluation.hitCount),
  ]);
}

async function insertRuleEvaluations(
  manager: EntityManager,
  evaluations: StoredEvaluationWithId[],
): Promise<void> {
  const rows = evaluations.flatMap((evaluation) =>
    evaluation.ruleEvaluations.map((ruleEvaluation) => ({
      ...ruleEvaluation,
      transactionEvaluationId: evaluation.id,
    })),
  );

  if (rows.length === 0) {
    return;
  }

  await manager.query(INSERT_RULE_EVALUATIONS, [
    rows.map((row) => row.transactionEvaluationId),
    rows.map((row) => row.ruleVersionId),
    rows.map((row) => row.outcome),
    rows.map((row) => row.skipReason),
    rows.map((row) => row.rawScore),
    rows.map((row) => row.adjustedScore),
    rows.map((row) => toJsonOrNull(row.features)),
    rows.map((row) => toJsonOrNull(row.trace)),
    rows.map((row) => JSON.stringify(row.contextRefs)),
    rows.map((row) => row.errorMessage),
  ]);
}

function toJsonOrNull(value: object | null): string | null {
  return value === null ? null : JSON.stringify(value);
}

function countByVerdict(
  evaluations: StoredTransactionEvaluation[],
  verdict: StoredTransactionEvaluation["verdict"],
): number {
  return evaluations.filter((evaluation) => evaluation.verdict === verdict).length;
}

// The run only fixes deterministic versions (listRunnableRuleVersionIds), so an agentic one here is a bug.
function toDeterministicRunRuleVersion(row: RunRuleVersionRow): DeterministicRunRuleVersion {
  const { definition, baseScore } = row;

  if (definition === null || baseScore === null) {
    throw new AgenticRuleNotSupportedError(`Rule ${row.ruleCode} has no deterministic definition`);
  }

  return { ...row, definition, baseScore };
}

function groupWhitelistByRule(rows: { ruleId: string; clientId: string }[]): Map<string, Set<string>> {
  const clientIdsByRuleId = new Map<string, Set<string>>();

  for (const row of rows) {
    const clientIds = clientIdsByRuleId.get(row.ruleId) ?? new Set<string>();
    clientIds.add(row.clientId);
    clientIdsByRuleId.set(row.ruleId, clientIds);
  }

  return clientIdsByRuleId;
}
