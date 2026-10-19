import { z } from "zod";

import { riskProfileSchema, ruleTypeSchema } from "@/features/rules/types";

export const BUCKETS = ["ok", "to_check", "alert"] as const;
export const bucketSchema = z.enum(BUCKETS);
export type Bucket = z.infer<typeof bucketSchema>;

export const bucketCountsSchema = z.object({ ok: z.number(), to_check: z.number(), alert: z.number() });
export type BucketCounts = z.infer<typeof bucketCountsSchema>;

export const batchStatusSchema = z.enum(["processing", "completed", "failed"]);
export type BatchStatus = z.infer<typeof batchStatusSchema>;

export const batchSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  uploadedAt: z.string(),
  /** When the run completed or failed; null while it is processing. */
  finishedAt: z.string().nullable(),
  uploadedBy: z.string(),
  status: batchStatusSchema,
  /** Data rows found in the uploaded file. */
  fileRowCount: z.number(),
  /** Rows that are (or will be) evaluated. Lower than fileRowCount when the source caps processing. */
  evaluatedRowCount: z.number(),
  processedRowCount: z.number(),
  activeRuleCount: z.number(),
  counts: bucketCountsSchema,
  failureReason: z.string().nullable(),
  /** A database run with an empty scope, so it evaluated every transaction in the system. */
  isFullDatasetRun: z.boolean(),
});
export type Batch = z.infer<typeof batchSchema>;

export const transactionSchema = z.object({
  transactionId: z.string(),
  clientId: z.string(),
  bookedAt: z.string(),
  amount: z.number(),
  currency: z.string(),
  amountCzk: z.number(),
  payerCountry: z.string(),
  payeeCountry: z.string(),
  payerAccount: z.string(),
  payeeAccount: z.string(),
  transactionType: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;

/** A transaction as shown in a batch. The live API knows the CZK amount only from the rule results. */
export const transactionViewSchema = transactionSchema.extend({ amountCzk: z.number().nullable() });
export type TransactionView = z.infer<typeof transactionViewSchema>;

export const batchTransactionSchema = z.object({
  transaction: transactionViewSchema,
  bucket: bucketSchema,
  failedRuleCount: z.number(),
  maxAdjustedScore: z.number(),
});
export type BatchTransaction = z.infer<typeof batchTransactionSchema>;

export const batchTransactionPageSchema = z.object({
  items: z.array(batchTransactionSchema),
  nextCursor: z.string().nullable(),
  totalCount: z.number(),
});
export type BatchTransactionPage = z.infer<typeof batchTransactionPageSchema>;

export const traceStepSchema = z.object({ condition: z.string(), isMet: z.boolean(), detail: z.string() });
export type TraceStep = z.infer<typeof traceStepSchema>;

export const ruleEvaluationSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  ruleType: ruleTypeSchema,
  ruleVersionNumber: z.number(),
  /**
   * Score a matching deterministic rule gets in full (not a share per condition). Null when unknown: agentic
   * rules, failed evaluations and mock checks, whose score varies per transaction.
   */
  baseScore: z.number().nullable(),
  sensitivity: z.number(),
  score: z.number(),
  adjustedScore: z.number(),
  isFailed: z.boolean(),
  trace: z.array(traceStepSchema),
});
export type RuleEvaluation = z.infer<typeof ruleEvaluationSchema>;

export const skipReasonSchema = z.enum(["whitelisted", "risk_profile_not_applicable"]);
export type SkipReason = z.infer<typeof skipReasonSchema>;

export const transactionEvaluationSchema = z.object({
  batchId: z.string(),
  transaction: transactionViewSchema,
  client: z.object({
    id: z.string(),
    riskProfile: riskProfileSchema,
    isPep: z.boolean(),
    country: z.string(),
  }),
  bucket: bucketSchema,
  failedRules: z.array(ruleEvaluationSchema),
  passedRules: z.array(ruleEvaluationSchema),
  skippedRules: z.array(z.object({ ruleId: z.string(), ruleName: z.string(), reason: skipReasonSchema })),
});
export type TransactionEvaluation = z.infer<typeof transactionEvaluationSchema>;

/**
 * Which transactions already in the system a run evaluates; every field is optional and an empty scope means
 * all of them. Dates are local "YYYY-MM-DD", `from` inclusive and `to` exclusive. `limit` keeps the first
 * transactions in chronological order.
 */
export type RunScope = { limit?: number; from?: string; to?: string };

export type LoadBatchTransactionsInput = { batchId: string; bucket: Bucket; cursor: string | null };
