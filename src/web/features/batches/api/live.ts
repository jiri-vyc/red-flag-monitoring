import { getCurrentUser, formatUserName } from "@/config/currentUser";
import { formatRuleName } from "@/features/rules/api/dto";
import { ApiError } from "@/lib/apiError";
import { requestJson } from "@/lib/httpClient";
import { parseOffsetCursor } from "@/lib/offsetCursor";

import type { Batch, BatchStatus, Bucket, RuleEvaluation, RunScope, SkipReason, TraceStep } from "../types";
import type { BatchesService } from "./contract";
import {
  evaluationRunPageDtoSchema,
  evaluationRunSummaryDtoSchema,
  startedRunDtoSchema,
  transactionEvaluationDetailDtoSchema,
  transactionEvaluationPageDtoSchema,
  isEvaluatedConditionGroup,
  type EvaluatedConditionNodeDto,
  type EvaluatedOperandDto,
  type EvaluationRunListItemDto,
  type RuleEvaluationDetailDto,
  type StartRunBodyDto,
  type TransactionDto,
  type VerdictDto,
  toTransactionView,
} from "./dto";

// A batch is an evaluation run. The run list endpoint allows at most 500 items per page.
const RUN_LIST_LIMIT = 500;
const TRANSACTION_PAGE_SIZE = 25;

// Buckets are the web's names for verdicts. An `error` verdict must go to a human, like `to_check`.
const VERDICT_BY_BUCKET: Record<Bucket, VerdictDto> = { ok: "pass", to_check: "error", alert: "flagged" };
const BUCKET_BY_VERDICT: Record<VerdictDto, Bucket> = { pass: "ok", error: "to_check", flagged: "alert" };

const SKIP_REASON_BY_DTO: Record<"whitelist" | "risk_profile", SkipReason> = {
  whitelist: "whitelisted",
  risk_profile: "risk_profile_not_applicable",
};

const runPath = (runId: string) => `/evaluation-runs/${encodeURIComponent(runId)}`;

function toBatchStatus(status: EvaluationRunListItemDto["status"]): BatchStatus {
  return status === "importing" || status === "running" ? "processing" : status;
}

function isFullDatasetScope(scope: EvaluationRunListItemDto["scope"]): boolean {
  return scope !== null && Object.values(scope).every((value) => value === null);
}

function toBatch(run: EvaluationRunListItemDto, activeRuleCount: number): Batch {
  return {
    id: run.id,
    fileName: run.fileName,
    uploadedAt: run.createdAt,
    finishedAt: run.finishedAt,
    uploadedBy: formatUserName(run.createdBy),
    status: toBatchStatus(run.status),
    fileRowCount: run.rowsTotal,
    evaluatedRowCount: run.rowsImported,
    processedRowCount: run.txProcessed,
    activeRuleCount,
    counts: { ok: run.txPassed, to_check: run.txError, alert: run.txFlagged },
    failureReason: run.errorMessage,
    isFullDatasetRun: isFullDatasetScope(run.scope),
  };
}

async function loadBatch(batchId: string): Promise<Batch> {
  const summary = await requestJson({ path: runPath(batchId), schema: evaluationRunSummaryDtoSchema });
  return toBatch(summary.run, summary.ruleVersions.length);
}

/** Sends only the scope fields that are set; an empty scope runs over every transaction in the database. */
function toStartRunBody(scope: RunScope): StartRunBodyDto {
  const setScopeEntries = Object.entries(scope).filter(([, value]) => value !== undefined);
  // getCurrentUser().id is the backend's default creator (DEMO_ADMIN_USER_ID), sent so the run names its starter.
  return {
    createdBy: getCurrentUser().id,
    ...(setScopeEntries.length > 0 && { scope: Object.fromEntries(setScopeEntries) }),
  };
}

/** The CZK amount is not a transaction column; rules record it as the `amount_czk` feature with the FX rate used. */
function findAmountCzk(
  transaction: TransactionDto,
  ruleEvaluations: RuleEvaluationDetailDto[],
): number | null {
  const amountCzkFeature = ruleEvaluations
    .map((ruleEvaluation) => ruleEvaluation.features?.amount_czk)
    .find((value) => typeof value === "number");
  if (typeof amountCzkFeature === "number") {
    return amountCzkFeature;
  }
  return transaction.currency === "CZK" ? Number(transaction.amount) : null;
}

function formatOperand(operand: EvaluatedOperandDto): string {
  const name = operand.feature ?? operand.expr ?? operand.list;
  const value = Array.isArray(operand.value) ? operand.value.join(", ") : String(operand.value);
  return name === undefined ? value : `${name} (${value})`;
}

/** Flattens nested groups depth first; a step inside a group is prefixed with the labels of its groups. */
function toConditionTraceSteps(nodes: EvaluatedConditionNodeDto[], groupLabels: string[]): TraceStep[] {
  return nodes.flatMap((node) => {
    const condition = [...groupLabels, node.label].join(" › ");
    if (isEvaluatedConditionGroup(node)) {
      const groupStep = {
        condition,
        isMet: node.result,
        detail: `${node.match} (${node.conditions.length})`,
      };
      return [groupStep, ...toConditionTraceSteps(node.conditions, [...groupLabels, node.label])];
    }
    return [
      {
        condition,
        isMet: node.result,
        detail: `${formatOperand(node.left)} ${node.op} ${formatOperand(node.right)}`,
      },
    ];
  });
}

function toTraceSteps(ruleEvaluation: RuleEvaluationDetailDto): TraceStep[] {
  const { trace } = ruleEvaluation;
  if (ruleEvaluation.outcome === "error") {
    return [{ condition: "Evaluation error", isMet: false, detail: ruleEvaluation.errorMessage ?? "" }];
  }
  if (trace === null) {
    return [];
  }
  if ("conditions" in trace) {
    return toConditionTraceSteps(trace.conditions, []);
  }
  return [{ condition: trace.summary, isMet: ruleEvaluation.outcome === "hit", detail: trace.reasoning }];
}

function toRuleEvaluation(ruleEvaluation: RuleEvaluationDetailDto): RuleEvaluation {
  return {
    ruleId: ruleEvaluation.rule.id,
    ruleName: formatRuleName(ruleEvaluation.rule),
    ruleType: ruleEvaluation.rule.kind,
    ruleVersionNumber: ruleEvaluation.ruleVersion.versionNo,
    // An errored evaluation produced no score, so the base-score calculation does not apply to it.
    baseScore: ruleEvaluation.outcome === "error" ? null : ruleEvaluation.ruleVersion.baseScore,
    sensitivity: ruleEvaluation.ruleVersion.sensitivity,
    score: ruleEvaluation.rawScore ?? 0,
    adjustedScore: ruleEvaluation.adjustedScore ?? 0,
    isFailed: ruleEvaluation.outcome !== "pass",
    trace: toTraceSteps(ruleEvaluation),
    escalationRole: ruleEvaluation.ruleVersion.escalationRole,
  };
}

export const liveBatchesService: BatchesService = {
  capabilities: {
    canUploadBatch: false,
    canStartRun: true,
  },

  async loadBatches() {
    const runPage = await requestJson({
      path: `/evaluation-runs?limit=${RUN_LIST_LIMIT}`,
      schema: evaluationRunPageDtoSchema,
    });
    // The run list has no rule versions and the batch list does not show the rule count.
    return runPage.items.map((run) => toBatch(run, 0));
  },

  loadBatch,

  // 202 with the run created as `running`; the batch detail then polls GET /evaluation-runs/:runId until the
  // run is completed or failed.
  async startRun({ scope }) {
    const run = await requestJson({
      path: "/evaluation-runs",
      method: "POST",
      jsonBody: toStartRunBody(scope),
      schema: startedRunDtoSchema,
    });
    return loadBatch(run.id);
  },

  // V14: runs are created by the evaluation engine, the API has no upload endpoint. Hidden in the UI.
  uploadBatch: async () => {
    throw new ApiError({
      kind: "unsupported",
      message: "Uploading a transactions CSV is not supported by the API yet.",
    });
  },

  async loadBatchTransactions({ batchId, bucket, cursor, role }) {
    const offset = parseOffsetCursor(cursor);
    const searchParams = new URLSearchParams({
      verdict: VERDICT_BY_BUCKET[bucket],
      role,
      limit: String(TRANSACTION_PAGE_SIZE),
      offset: String(offset),
    });
    const page = await requestJson({
      path: `${runPath(batchId)}/transactions?${searchParams.toString()}`,
      schema: transactionEvaluationPageDtoSchema,
    });
    const nextOffset = page.offset + page.items.length;
    return {
      items: page.items.map((item) => ({
        // The list has no rule results, so no CZK amount; only the transaction detail shows it.
        transaction: toTransactionView(item.transaction, null),
        bucket: BUCKET_BY_VERDICT[item.verdict],
        // hitRules holds only the role's hits, so the count and score match what the detail shows.
        failedRuleCount: item.hitRules.length,
        maxAdjustedScore: Math.max(0, ...item.hitRules.map((hitRule) => hitRule.adjustedScore)),
      })),
      nextCursor: nextOffset < page.total ? String(nextOffset) : null,
      totalCount: page.total,
    };
  },

  async loadTransactionEvaluation({ batchId, transactionId, role }) {
    const detail = await requestJson({
      path: `${runPath(batchId)}/transactions/${encodeURIComponent(transactionId)}?role=${role}`,
      schema: transactionEvaluationDetailDtoSchema,
    });
    const { ruleEvaluations } = detail;
    return {
      batchId: detail.evaluation.runId,
      transaction: toTransactionView(detail.transaction, findAmountCzk(detail.transaction, ruleEvaluations)),
      client: {
        id: detail.client.clientId,
        riskProfile: detail.client.amlRiskScore,
        isPep: detail.client.isPep,
        country: detail.client.country,
      },
      bucket: BUCKET_BY_VERDICT[detail.evaluation.verdict],
      // Errored rules are listed with the failed ones: the transaction must go to a human either way.
      failedRules: ruleEvaluations
        .filter(({ outcome }) => outcome === "hit" || outcome === "error")
        .map(toRuleEvaluation),
      passedRules: ruleEvaluations.filter(({ outcome }) => outcome === "pass").map(toRuleEvaluation),
      skippedRules: ruleEvaluations.flatMap((ruleEvaluation) =>
        ruleEvaluation.outcome === "not_applicable" && ruleEvaluation.skipReason !== null
          ? [
              {
                ruleId: ruleEvaluation.rule.id,
                ruleName: formatRuleName(ruleEvaluation.rule),
                reason: SKIP_REASON_BY_DTO[ruleEvaluation.skipReason],
              },
            ]
          : [],
      ),
    };
  },
};
