import { z } from "zod";

import { BACKEND_RISK_PROFILES } from "@/features/rules/api/dto";
import { userRoleSchema } from "@/features/users/types";

import type { TransactionView } from "../types";

// Response DTOs of /api/evaluation-runs (src/backend/src/delivery/http/evaluationRunsRouter.ts and
// application/evaluationRuns/evaluationRunReadModels.ts).

export const VERDICTS = ["pass", "flagged", "error"] as const;
export type VerdictDto = (typeof VERDICTS)[number];

/** Backend RunScope: which database transactions a run evaluates; null on a run over an uploaded CSV. */
const runScopeDtoSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  clientIds: z.array(z.string()).nullable(),
  limit: z.number().int().nullable(),
});

export const evaluationRunListItemDtoSchema = z.object({
  id: z.string(),
  status: z.enum(["importing", "running", "completed", "failed"]),
  scope: runScopeDtoSchema.nullable(),
  fileName: z.string(),
  rowsTotal: z.number().int(),
  rowsImported: z.number().int(),
  txProcessed: z.number().int(),
  txPassed: z.number().int(),
  txFlagged: z.number().int(),
  txError: z.number().int(),
  hitThreshold: z.number().int(),
  createdBy: z.string(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
});
export type EvaluationRunListItemDto = z.infer<typeof evaluationRunListItemDtoSchema>;

export const evaluationRunPageDtoSchema = z.object({
  items: z.array(evaluationRunListItemDtoSchema),
  total: z.number().int(),
});

/** Body of POST /evaluation-runs; the backend defaults every omitted field. */
export type StartRunBodyDto = {
  createdBy: string;
  scope?: { from?: string; to?: string; limit?: number };
};

/** 202 response of POST /evaluation-runs (backend EvaluationRun); the web reloads the run summary by its id. */
export const startedRunDtoSchema = z.object({ id: z.string() });

export const evaluationRunSummaryDtoSchema = z.object({
  run: evaluationRunListItemDtoSchema,
  ruleVersions: z.array(z.object({ ruleVersionId: z.string() })),
});

export const transactionDtoSchema = z.object({
  transactionId: z.string(),
  clientId: z.string(),
  occurredAt: z.string(),
  // numeric(14, 2) travels as a decimal string.
  amount: z.string(),
  currency: z.string(),
  payerCountry: z.string(),
  payeeCountry: z.string(),
  payerAccount: z.string().nullable(),
  payeeAccount: z.string(),
  transactionType: z.string(),
});
export type TransactionDto = z.infer<typeof transactionDtoSchema>;

export function toTransactionView(transaction: TransactionDto, amountCzk: number | null): TransactionView {
  return {
    transactionId: transaction.transactionId,
    clientId: transaction.clientId,
    bookedAt: transaction.occurredAt,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    amountCzk,
    payerCountry: transaction.payerCountry,
    payeeCountry: transaction.payeeCountry,
    payerAccount: transaction.payerAccount ?? "",
    payeeAccount: transaction.payeeAccount,
    transactionType: transaction.transactionType,
  };
}

export const transactionEvaluationDtoSchema = z.object({
  transactionId: z.string(),
  verdict: z.enum(VERDICTS),
  maxScore: z.number(),
  hitCount: z.number().int(),
});

// Hits of the listed transaction; with `role` the backend keeps only hits escalated to that role (issue #6).
const hitRuleDtoSchema = z.object({
  ruleVersionId: z.string(),
  ruleCode: z.string(),
  adjustedScore: z.number(),
  escalationRole: userRoleSchema,
});

export const transactionEvaluationPageDtoSchema = z.object({
  items: z.array(
    transactionEvaluationDtoSchema.extend({
      transaction: transactionDtoSchema,
      hitRules: z.array(hitRuleDtoSchema),
    }),
  ),
  limit: z.number().int(),
  offset: z.number().int(),
  total: z.number().int(),
});

const operandValueSchema = z.union([z.number(), z.string(), z.boolean(), z.null(), z.array(z.string())]);

const evaluatedOperandSchema = z.object({
  feature: z.string().optional(),
  expr: z.string().optional(),
  list: z.string().optional(),
  value: operandValueSchema,
});
export type EvaluatedOperandDto = z.infer<typeof evaluatedOperandSchema>;

const evaluatedConditionSchema = z.object({
  label: z.string(),
  left: evaluatedOperandSchema,
  op: z.string(),
  right: evaluatedOperandSchema,
  result: z.boolean(),
});
export type EvaluatedConditionDto = z.infer<typeof evaluatedConditionSchema>;

/** A nested group of the rule definition with its own result (backend EvaluatedConditionGroup). */
export type EvaluatedConditionGroupDto = {
  label: string;
  match: "any" | "all";
  conditions: EvaluatedConditionNodeDto[];
  result: boolean;
};
export type EvaluatedConditionNodeDto = EvaluatedConditionDto | EvaluatedConditionGroupDto;

const evaluatedConditionGroupSchema: z.ZodType<EvaluatedConditionGroupDto> = z.object({
  label: z.string(),
  match: z.enum(["any", "all"]),
  // A getter defers the recursive reference until the node schema below exists.
  get conditions() {
    return z.array(evaluatedConditionNodeSchema);
  },
  result: z.boolean(),
});

const evaluatedConditionNodeSchema: z.ZodType<EvaluatedConditionNodeDto> = z.union([
  evaluatedConditionSchema,
  evaluatedConditionGroupSchema,
]);

export function isEvaluatedConditionGroup(
  node: EvaluatedConditionNodeDto,
): node is EvaluatedConditionGroupDto {
  return "match" in node;
}

const deterministicTraceSchema = z.object({
  conditions: z.array(evaluatedConditionNodeSchema),
  summary: z.string(),
});

const agenticTraceSchema = z.object({ reasoning: z.string(), summary: z.string() });

export const ruleEvaluationDetailDtoSchema = z.object({
  outcome: z.enum(["pass", "hit", "not_applicable", "error"]),
  skipReason: z.enum(["whitelist", "risk_profile"]).nullable(),
  rawScore: z.number().nullable(),
  adjustedScore: z.number().nullable(),
  features: z.record(z.string(), z.unknown()).nullable(),
  trace: z.union([deterministicTraceSchema, agenticTraceSchema]).nullable(),
  errorMessage: z.string().nullable(),
  rule: z.object({
    id: z.string(),
    code: z.string(),
    alertType: z.string(),
    kind: z.enum(["deterministic", "agentic"]),
  }),
  ruleVersion: z.object({
    versionNo: z.number().int(),
    baseScore: z.number().nullable(),
    sensitivity: z.number(),
    escalationRole: userRoleSchema,
  }),
});
export type RuleEvaluationDetailDto = z.infer<typeof ruleEvaluationDetailDtoSchema>;

export const transactionEvaluationDetailDtoSchema = z.object({
  evaluation: transactionEvaluationDtoSchema.extend({ runId: z.string() }),
  transaction: transactionDtoSchema,
  client: z.object({
    clientId: z.string(),
    country: z.string(),
    isPep: z.boolean(),
    amlRiskScore: z.enum(BACKEND_RISK_PROFILES),
  }),
  ruleEvaluations: z.array(ruleEvaluationDetailDtoSchema),
});
export type TransactionEvaluationDetailDto = z.infer<typeof transactionEvaluationDetailDtoSchema>;
