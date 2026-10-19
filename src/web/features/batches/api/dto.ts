import { z } from "zod";

import { BACKEND_RISK_PROFILES } from "@/features/rules/api/dto";

// Response DTOs of /api/evaluation-runs (src/backend/src/delivery/http/evaluationRunsRouter.ts and
// application/evaluationRuns/evaluationRunReadModels.ts).

export const VERDICTS = ["pass", "flagged", "error"] as const;
export type VerdictDto = (typeof VERDICTS)[number];

export const evaluationRunListItemDtoSchema = z.object({
  id: z.string(),
  status: z.enum(["importing", "running", "completed", "failed"]),
  fileName: z.string(),
  rowsTotal: z.number().int(),
  rowsImported: z.number().int(),
  txProcessed: z.number().int(),
  txPassed: z.number().int(),
  txFlagged: z.number().int(),
  txError: z.number().int(),
  createdBy: z.string(),
  createdAt: z.string(),
  errorMessage: z.string().nullable(),
});
export type EvaluationRunListItemDto = z.infer<typeof evaluationRunListItemDtoSchema>;

export const evaluationRunPageDtoSchema = z.object({
  items: z.array(evaluationRunListItemDtoSchema),
  total: z.number().int(),
});

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

export const transactionEvaluationDtoSchema = z.object({
  transactionId: z.string(),
  verdict: z.enum(VERDICTS),
  maxScore: z.number(),
  hitCount: z.number().int(),
});

export const transactionEvaluationPageDtoSchema = z.object({
  items: z.array(transactionEvaluationDtoSchema.extend({ transaction: transactionDtoSchema })),
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

const deterministicTraceSchema = z.object({
  conditions: z.array(
    z.object({
      label: z.string(),
      left: evaluatedOperandSchema,
      op: z.string(),
      right: evaluatedOperandSchema,
      result: z.boolean(),
    }),
  ),
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
  ruleVersion: z.object({ versionNo: z.number().int(), sensitivity: z.number() }),
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
