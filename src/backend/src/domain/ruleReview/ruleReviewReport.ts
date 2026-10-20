import type { AmlRiskScore, ClientType } from "../client";
import type { RuleDefinition } from "../ruleDefinition";
import type { ParameterType, RuleReviewParams } from "./ruleReviewParams";

// `findings` and `coverageMatrix` belong to the deterministic part, `llm` to the Bedrock part; neither writes the other's.

export const RULE_REVIEW_STATUSES = ["running", "completed", "failed"] as const;
export type RuleReviewStatus = (typeof RULE_REVIEW_STATUSES)[number];

export const FINDING_KINDS = ["rule_adjustment", "new_rule", "coverage_gap", "association"] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const STUCK_REVIEW_AFTER_MS = 20 * 60 * 1000;
export const STUCK_REVIEW_MESSAGE = "The review did not finish within 20 minutes";

export type CoverageMatrixRow = { indicator: string; label: string; ruleCodes: string[] };

export type ParameterProposal = {
  parameter: string;
  parameterType: ParameterType;
  currentValue: number;
  proposedValue: number;
  step: number;
};

export type FindingClient = {
  clientId: string;
  transactionIds: string[];
  nearMissCount: number;
  distinctDays: number;
  minDistance: number | null;
  seedLinks: { seedClientId: string; seedReasons: string[]; accounts: string[] }[];
};

export type RuleReviewFinding = {
  id: string;
  kind: FindingKind;
  rule: { ruleId: string; ruleVersionId: string; code: string; label: string } | null;
  proposal: ParameterProposal | { definition: RuleDefinition } | null;
  growth: { baseClients: number; addedClients: number; capExceeded: boolean } | null;
  clients: FindingClient[];
  evidence: Record<string, unknown>;
};

export type CitedEvidence = { path: string; value: unknown };

export type FindingExplanation = {
  summary: string;
  typology: string;
  adjustmentConsiderations: string;
  investigationSteps: string[];
  citedEvidence: CitedEvidence[];
  unverifiedCitations: CitedEvidence[];
};

export type RuleBacktest = {
  violation: string | null;
  hitCount: number;
  clientCount: number;
  clientShare: number;
  overlapByRuleCode: Record<string, number>;
  maxOverlap: { ruleCode: string; share: number } | null;
  clientsByRiskScore: Record<AmlRiskScore, number>;
  clientsByClientType: Record<ClientType, number>;
  sampleClientIds: string[];
  discardReason: string | null;
};

export const HYPOTHESIS_KINDS = ["new_rule", "coverage_gap"] as const;
export type HypothesisKind = (typeof HYPOTHESIS_KINDS)[number];

// A coverage_gap hypothesis needs a feature the catalogue lacks: no definition, no backtest.
export type RuleHypothesis = {
  id: string;
  kind: HypothesisKind;
  missingFeature: string | null;
  definition: RuleDefinition | null;
  descriptionCs: string;
  indicator: string | null;
  suggestedLegalBasis: string | null;
  rationale: string;
  backtest: RuleBacktest | null;
};

export type LlmCallAudit = {
  purpose: "explanation" | "summary" | "hypotheses";
  findingId: string | null;
  modelId: string;
  prompt: unknown;
  toolCalls: { name: string; input: unknown; result: unknown }[];
  response: unknown;
  inputTokens: number;
  outputTokens: number;
  startedAt: string;
  durationMs: number;
  errorMessage: string | null;
};

export type RuleReviewLlmSection = {
  summary: string | null;
  // Numbers the summary states that are not in its input; the officer checks them before relying on it.
  summaryUnverifiedNumbers: string[];
  explanations: Record<string, FindingExplanation>;
  hypotheses: RuleHypothesis[];
  critiques: Record<string, string>;
  calls: LlmCallAudit[];
  errors: string[];
};

export type RuleReviewReport = {
  id: string;
  status: RuleReviewStatus;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  createdBy: string;
  engineVersion: string;
  params: RuleReviewParams;
  input: {
    ruleVersionIds: string[];
    referenceListVersionIds: string[];
    transactionSetDigest: string;
    evaluationRunId: string | null;
  };
  progress: { stage: string; done: number; total: number };
  coverageMatrix: CoverageMatrixRow[];
  findings: RuleReviewFinding[];
  llm: RuleReviewLlmSection;
};

export const EMPTY_LLM_SECTION: RuleReviewLlmSection = {
  summary: null,
  summaryUnverifiedNumbers: [],
  explanations: {},
  hypotheses: [],
  critiques: {},
  calls: [],
  errors: [],
};

export function isFinishedReview(report: Pick<RuleReviewReport, "status">): boolean {
  return report.status !== "running";
}

// Only how the report is shown; the stored document stays `running`.
export function resolveStuckReview(report: RuleReviewReport, now: Date): RuleReviewReport {
  const runningForMs = now.getTime() - new Date(report.startedAt).getTime();

  if (report.status !== "running" || runningForMs <= STUCK_REVIEW_AFTER_MS) {
    return report;
  }

  return { ...report, status: "failed", errorMessage: STUCK_REVIEW_MESSAGE };
}

export type RuleReviewSummary = Pick<
  RuleReviewReport,
  "id" | "status" | "startedAt" | "finishedAt" | "errorMessage" | "createdBy" | "progress"
> & {
  evaluationRunId: string | null;
  findingCounts: Record<FindingKind, number>;
};

export function createRunningReport(input: {
  id: string;
  startedAt: Date;
  createdBy: string;
  engineVersion: string;
  params: RuleReviewParams;
  input: RuleReviewReport["input"];
}): RuleReviewReport {
  return {
    id: input.id,
    status: "running",
    startedAt: input.startedAt.toISOString(),
    finishedAt: null,
    errorMessage: null,
    createdBy: input.createdBy,
    engineVersion: input.engineVersion,
    params: input.params,
    input: input.input,
    progress: { stage: "queued", done: 0, total: 1 },
    coverageMatrix: [],
    findings: [],
    llm: EMPTY_LLM_SECTION,
  };
}

export function summarizeReview(report: RuleReviewReport): RuleReviewSummary {
  const findingCounts = Object.fromEntries(FINDING_KINDS.map((kind) => [kind, 0])) as Record<
    FindingKind,
    number
  >;

  for (const finding of report.findings) {
    findingCounts[finding.kind] += 1;
  }

  return {
    id: report.id,
    status: report.status,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    errorMessage: report.errorMessage,
    createdBy: report.createdBy,
    progress: report.progress,
    evaluationRunId: report.input.evaluationRunId,
    findingCounts,
  };
}
