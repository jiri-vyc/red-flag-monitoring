import type { AmlRiskScore } from "./client";
import type { JsonValue } from "./json";
import type { ComparisonOperator, ConditionLogic, ConditionOperand } from "./ruleDefinition";

export const RUN_STATUSES = ["importing", "running", "completed", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const VERDICTS = ["pass", "flagged", "error"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const RULE_OUTCOMES = ["pass", "hit", "not_applicable", "error"] as const;
export type RuleOutcome = (typeof RULE_OUTCOMES)[number];

export const SCORED_RULE_OUTCOMES = ["pass", "hit"] as const satisfies readonly RuleOutcome[];

export const SKIP_REASONS = ["whitelist", "risk_profile"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export const DEFAULT_HIT_THRESHOLD = 50;

// Shape of evaluation_runs.import_errors; the import keeps at most this many rejected rows.
export const MAX_IMPORT_ERRORS = 1000;
export type ImportRowError = { row_no: number; column: string | null; message: string };

// Shapes of rule_evaluations.features and .trace, see "Trace" in spec/datovy-model.md. Keys stay snake_case
// as stored, so trace ->> 'summary' and similar SQL keeps working.
export type FxRateSnapshot = { currency: string; rate_date: string; czk_per_unit: number };
export type FeatureValue = number | string | boolean | null | string[] | FxRateSnapshot;
export type RuleFeatures = Record<string, FeatureValue>;

export type OperandValue = number | string | boolean | null | string[];
export type EvaluatedOperand = ConditionOperand & { value: OperandValue };

export type EvaluatedCondition = {
  id: string;
  label: string;
  left: EvaluatedOperand;
  op: ComparisonOperator;
  right: EvaluatedOperand;
  result: boolean;
};

export type EvaluatedConditionGroup = {
  id: string;
  label: string;
  match: ConditionLogic;
  conditions: EvaluatedConditionNode[];
  result: boolean;
};

export type EvaluatedConditionNode = EvaluatedCondition | EvaluatedConditionGroup;

export type DeterministicTrace = {
  logic: ConditionLogic;
  conditions: EvaluatedConditionNode[];
  matched: boolean;
  summary: string;
};

// Structured LLM output of an agentic rule. `summary` is required so the path-to-regulation query reads
// both trace kinds the same way.
export type CitedDatum = { feature: string; value: FeatureValue };
export type AgenticTrace = { reasoning: string; cited_data: CitedDatum[]; summary: string };

export type RuleTrace = DeterministicTrace | AgenticTrace;

// Raw Amazon Bedrock Converse response, stored as returned (M13).
export type LlmResponse = {
  output: { message: { role: "assistant"; content: JsonValue[] } };
  stopReason: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  metrics?: { latencyMs: number };
};

export type EvaluationRun = {
  id: string;
  status: RunStatus;
  fileName: string;
  fileSha256: string;
  rowsTotal: number;
  rowsImported: number;
  rowsRejected: number;
  importErrors: ImportRowError[];
  hitThreshold: number;
  engineVersion: string;
  txProcessed: number;
  txPassed: number;
  txFlagged: number;
  txError: number;
  createdBy: string;
  createdAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
};

export type TransactionEvaluation = {
  id: string;
  runId: string;
  transactionId: string;
  clientId: string;
  sourceRowNo: number;
  clientRiskProfile: AmlRiskScore;
  verdict: Verdict;
  maxScore: number;
  hitCount: number;
  evaluatedAt: Date;
};

export type RuleEvaluation = {
  id: string;
  transactionEvaluationId: string;
  ruleVersionId: string;
  outcome: RuleOutcome;
  skipReason: SkipReason | null;
  rawScore: number | null;
  adjustedScore: number | null;
  features: RuleFeatures | null;
  trace: RuleTrace | null;
  contextRefs: string[];
  llmPrompt: string | null;
  llmResponse: LlmResponse | null;
  llmModelId: string | null;
  errorMessage: string | null;
};
