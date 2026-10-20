import type { DataSource } from "typeorm";

import { UNLIMITED_RUN_SCOPE } from "../../application/evaluationRuns/runScope";
import { NotFoundError } from "../../application/errors";
import type {
  RuleCatalogueEntry,
  RuleReviewInputRepository,
  RuleReviewRuleSet,
} from "../../application/ruleReviews/ruleReviewPorts";
import type { DeterministicRunRuleVersion } from "../../domain/evaluateTransaction";
import type { RuleDefinition } from "../../domain/ruleDefinition";
import type { EvaluationDataset } from "../../domain/transactionEvaluator";
import { TypeOrmEvaluationInputRepository } from "../database/repositories/TypeOrmEvaluationInputRepository";
import { TypeOrmEvaluationRunRepository } from "../database/repositories/TypeOrmEvaluationRunRepository";

const LIST_ACTIVE_RULE_VERSIONS = `
  -- Active approved versions of enabled deterministic rules, as a new evaluation run would fix them (V5)
  SELECT rv."id" AS "ruleVersionId", r."id" AS "ruleId", r."code" AS "ruleCode",
         r."whitelist_allowed" AS "isWhitelistAllowed", rv."definition", rv."base_score" AS "baseScore",
         rv."sensitivity", rv."risk_profiles" AS "riskProfiles"
  FROM "rules" r
  JOIN "rule_versions" rv ON rv."id" = r."active_version_id"
  WHERE r."enabled" AND r."kind" = 'deterministic' AND rv."status" = 'approved'
  ORDER BY r."code"
`;

const LIST_LATEST_REFERENCE_LISTS = `
  -- Items of the latest version of every reference list (M9), by list code
  SELECT lv."id" AS "listVersionId", l."code",
         coalesce(array_agg(i."value" ORDER BY i."value") FILTER (WHERE i."value" IS NOT NULL), '{}') AS "items"
  FROM "reference_lists" l
  JOIN LATERAL (
    SELECT v."id" FROM "reference_list_versions" v WHERE v."list_id" = l."id" ORDER BY v."version_no" DESC LIMIT 1
  ) lv ON true
  LEFT JOIN "reference_list_items" i ON i."list_version_id" = lv."id"
  GROUP BY lv."id", l."code"
`;

const LIST_WHITELIST = `
  -- Current whitelist entries of the given rules
  SELECT DISTINCT "rule_id" AS "ruleId", "client_id" AS "clientId"
  FROM "whitelist_entries"
  WHERE "rule_id" = ANY($1::uuid[])
`;

const FIND_RUN_FIXED_VERSIONS = `
  -- Rule and reference list versions an evaluation run fixed (V5)
  SELECT
    ARRAY(SELECT "rule_version_id"::text FROM "run_rule_versions" WHERE "run_id" = $1 ORDER BY 1) AS "ruleVersionIds",
    ARRAY(SELECT "list_version_id"::text FROM "run_reference_list_versions" WHERE "run_id" = $1 ORDER BY 1)
      AS "referenceListVersionIds"
  FROM "evaluation_runs"
  WHERE "id" = $1
`;

const LIST_RULE_CATALOGUE = `
  -- Rule texts and legal bases of the reviewed rule versions, for the Bedrock explanations
  SELECT r."id" AS "ruleId", rv."id" AS "ruleVersionId", r."code", r."alert_type" AS "alertType",
         rv."human_text" AS "humanText",
         coalesce(json_agg(json_build_object('regulationCode', reg."code", 'ref', lb."ref") ORDER BY reg."code", lb."ref")
           FILTER (WHERE lb."id" IS NOT NULL), '[]') AS "legalBases"
  FROM "rule_versions" rv
  JOIN "rules" r ON r."id" = rv."rule_id"
  LEFT JOIN "rule_legal_bases" lb ON lb."rule_version_id" = rv."id"
  LEFT JOIN "regulation_versions" regv ON regv."id" = lb."regulation_version_id"
  LEFT JOIN "regulations" reg ON reg."id" = regv."regulation_id"
  WHERE rv."id" = ANY($1::uuid[])
  GROUP BY r."id", rv."id"
  ORDER BY r."code"
`;

type RuleVersionRow = Omit<DeterministicRunRuleVersion, "definition" | "baseScore"> & {
  definition: RuleDefinition | null;
  baseScore: number | null;
};

export class TypeOrmRuleReviewInputRepository implements RuleReviewInputRepository {
  private readonly evaluationInputRepository: TypeOrmEvaluationInputRepository;
  private readonly evaluationRunRepository: TypeOrmEvaluationRunRepository;

  constructor(private readonly dataSource: DataSource) {
    this.evaluationInputRepository = new TypeOrmEvaluationInputRepository(dataSource);
    this.evaluationRunRepository = new TypeOrmEvaluationRunRepository(dataSource);
  }

  loadRuleSet(input: { evaluationRunId: string | null; hitThreshold: number }): Promise<RuleReviewRuleSet> {
    return input.evaluationRunId
      ? this.loadRunRuleSet(input.evaluationRunId, input.hitThreshold)
      : this.loadActiveRuleSet(input.hitThreshold);
  }

  async loadRuleCatalogue(ruleVersionIds: string[]): Promise<RuleCatalogueEntry[]> {
    const rows = await this.dataSource.query<Omit<RuleCatalogueEntry, "label">[]>(LIST_RULE_CATALOGUE, [
      ruleVersionIds,
    ]);

    return rows.map((row) => ({ ...row, label: toRuleLabel(row.humanText, row.code) }));
  }

  loadDataset(): Promise<EvaluationDataset> {
    return this.evaluationInputRepository.loadDataset();
  }

  listTransactionIds(): Promise<string[]> {
    return this.evaluationInputRepository.listScopedTransactionIds(UNLIMITED_RUN_SCOPE);
  }

  private async loadRunRuleSet(runId: string, hitThreshold: number): Promise<RuleReviewRuleSet> {
    const [fixedVersions] = await this.dataSource.query<
      { ruleVersionIds: string[]; referenceListVersionIds: string[] }[]
    >(FIND_RUN_FIXED_VERSIONS, [runId]);

    if (!fixedVersions) {
      throw new NotFoundError("Evaluation run", runId);
    }

    const run = await this.evaluationRunRepository.findRun(runId);

    return {
      ruleSet: await this.evaluationRunRepository.loadRunRuleSet({
        runId,
        hitThreshold: run?.hitThreshold ?? hitThreshold,
      }),
      ...fixedVersions,
    };
  }

  private async loadActiveRuleSet(hitThreshold: number): Promise<RuleReviewRuleSet> {
    const [ruleVersionRows, referenceListRows] = await Promise.all([
      this.dataSource.query<RuleVersionRow[]>(LIST_ACTIVE_RULE_VERSIONS),
      this.dataSource.query<{ listVersionId: string; code: string; items: string[] }[]>(
        LIST_LATEST_REFERENCE_LISTS,
      ),
    ]);
    const ruleVersions = ruleVersionRows.flatMap(toDeterministicRuleVersion);
    const whitelistRows = await this.dataSource.query<{ ruleId: string; clientId: string }[]>(
      LIST_WHITELIST,
      [ruleVersions.map((ruleVersion) => ruleVersion.ruleId)],
    );

    return {
      ruleSet: {
        ruleVersions,
        referenceLists: new Map(referenceListRows.map((row) => [row.code, row.items])),
        whitelistedClientIdsByRuleId: groupWhitelistByRule(whitelistRows),
        hitThreshold,
      },
      ruleVersionIds: ruleVersions.map((ruleVersion) => ruleVersion.ruleVersionId),
      referenceListVersionIds: referenceListRows.map((row) => row.listVersionId).sort(),
    };
  }
}

function toRuleLabel(humanText: string, code: string): string {
  const firstSentence = humanText.split(". ")[0]?.trim();

  return firstSentence ? firstSentence.replace(/\.$/, "") : code;
}

function toDeterministicRuleVersion(row: RuleVersionRow): DeterministicRunRuleVersion[] {
  const { definition, baseScore } = row;

  return definition === null || baseScore === null ? [] : [{ ...row, definition, baseScore }];
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
