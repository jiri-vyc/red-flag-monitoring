import { z } from "zod";

export const RULE_REVIEW_STATUSES = ["running", "completed", "failed"] as const;
export const FINDING_KINDS = ["rule_adjustment", "new_rule", "coverage_gap", "association"] as const;
export const PARAMETER_TYPES = ["amount", "window", "ratio", "count", "band_edge", "categorical"] as const;

const progressDtoSchema = z.object({ stage: z.string(), done: z.number(), total: z.number() });

const findingCountsDtoSchema = z.object({
  rule_adjustment: z.number().int(),
  new_rule: z.number().int(),
  coverage_gap: z.number().int(),
  association: z.number().int(),
});

export const ruleReviewSummaryDtoSchema = z.object({
  id: z.string(),
  status: z.enum(RULE_REVIEW_STATUSES),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdBy: z.string(),
  progress: progressDtoSchema,
  evaluationRunId: z.string().nullable(),
  findingCounts: findingCountsDtoSchema,
});
export type RuleReviewSummaryDto = z.infer<typeof ruleReviewSummaryDtoSchema>;

export const ruleReviewListDtoSchema = z.array(ruleReviewSummaryDtoSchema);

const ruleDefinitionDtoSchema = z.object({
  match: z.enum(["any", "all"]),
  features: z.array(z.string()),
  conditions: z.array(z.unknown()),
});

const parameterProposalDtoSchema = z.object({
  parameter: z.string(),
  parameterType: z.enum(PARAMETER_TYPES),
  currentValue: z.number(),
  proposedValue: z.number(),
  step: z.number(),
});

const findingClientDtoSchema = z.object({
  clientId: z.string(),
  transactionIds: z.array(z.string()),
  nearMissCount: z.number().int(),
  distinctDays: z.number().int(),
  minDistance: z.number().nullable(),
  seedLinks: z.array(
    z.object({ seedClientId: z.string(), seedReasons: z.array(z.string()), accounts: z.array(z.string()) }),
  ),
});
export type FindingClientDto = z.infer<typeof findingClientDtoSchema>;

export const findingDtoSchema = z.object({
  id: z.string(),
  kind: z.enum(FINDING_KINDS),
  rule: z
    .object({ ruleId: z.string(), ruleVersionId: z.string(), code: z.string(), label: z.string() })
    .nullable(),
  proposal: z
    .union([parameterProposalDtoSchema, z.object({ definition: ruleDefinitionDtoSchema })])
    .nullable(),
  growth: z
    .object({ baseClients: z.number().int(), addedClients: z.number().int(), capExceeded: z.boolean() })
    .nullable(),
  clients: z.array(findingClientDtoSchema),
  evidence: z.record(z.string(), z.unknown()),
});
export type FindingDto = z.infer<typeof findingDtoSchema>;

const citedEvidenceDtoSchema = z.object({ path: z.string(), value: z.unknown() });

const findingExplanationDtoSchema = z.object({
  summary: z.string(),
  typology: z.string(),
  adjustmentConsiderations: z.string(),
  investigationSteps: z.array(z.string()),
  citedEvidence: z.array(citedEvidenceDtoSchema),
  unverifiedCitations: z.array(citedEvidenceDtoSchema).default([]),
});
export type FindingExplanationDto = z.infer<typeof findingExplanationDtoSchema>;

const ruleBacktestDtoSchema = z.object({
  violation: z.string().nullable(),
  hitCount: z.number().int(),
  clientCount: z.number().int(),
  clientShare: z.number(),
  maxOverlap: z.object({ ruleCode: z.string(), share: z.number() }).nullable(),
  sampleClientIds: z.array(z.string()),
  discardReason: z.string().nullable(),
});

const ruleHypothesisDtoSchema = z.object({
  id: z.string(),
  kind: z.enum(["new_rule", "coverage_gap"]),
  missingFeature: z.string().nullable(),
  definition: ruleDefinitionDtoSchema.nullable(),
  descriptionCs: z.string(),
  indicator: z.string().nullable(),
  suggestedLegalBasis: z.string().nullable(),
  rationale: z.string(),
  backtest: ruleBacktestDtoSchema.nullable(),
});
export type RuleHypothesisDto = z.infer<typeof ruleHypothesisDtoSchema>;

export const ruleReviewReportDtoSchema = z.object({
  id: z.string(),
  status: z.enum(RULE_REVIEW_STATUSES),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdBy: z.string(),
  engineVersion: z.string(),
  params: z.record(z.string(), z.unknown()),
  input: z.object({
    ruleVersionIds: z.array(z.string()),
    referenceListVersionIds: z.array(z.string()),
    transactionSetDigest: z.string(),
    evaluationRunId: z.string().nullable(),
  }),
  progress: progressDtoSchema,
  coverageMatrix: z.array(
    z.object({ indicator: z.string(), label: z.string(), ruleCodes: z.array(z.string()) }),
  ),
  findings: z.array(findingDtoSchema),
  llm: z.object({
    summary: z.string().nullable(),
    summaryUnverifiedNumbers: z.array(z.string()).default([]),
    explanations: z.record(z.string(), findingExplanationDtoSchema),
    hypotheses: z.array(ruleHypothesisDtoSchema),
    critiques: z.record(z.string(), z.string()),
    calls: z.array(z.unknown()),
    errors: z.array(z.string()),
  }),
});
export type RuleReviewReportDto = z.infer<typeof ruleReviewReportDtoSchema>;

export type StartRuleReviewBodyDto = { createdBy: string; llm?: boolean };
