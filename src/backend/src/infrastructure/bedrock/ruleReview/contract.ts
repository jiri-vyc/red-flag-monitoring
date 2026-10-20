import type { AmlRiskScore, ClientType, ContractChannel } from "../../../domain/client";
import type { FeatureDescription } from "../../../domain/features/featureCatalog";
import type { JsonValue } from "../../../domain/json";
import type { RuleDefinition } from "../../../domain/ruleDefinition";

// Mirrors step 1a's draft (domain/ruleReview/*, application/ruleReviews/ruleReviewPorts.ts) until it lands: swap the
// imports and delete this file. "1b proposal" marks the fields 1b asked 1a to add.

export type ParameterType = "amount" | "window" | "ratio" | "count" | "band_edge" | "categorical";

export type RelaxationCaps = {
  maxRelativeMove: { amount: number; window: number; ratio: number };
  stepSize: { amount: number; window: number; ratio: number };
  maxCountUnits: number;
  excludedRuleCodes: string[];
  regulatoryParameters: string[];
  repetition: { minDistinctDays: number; minClients: number };
};

export type GrowthCap = { minAddedClients: number; maxRelativeGrowth: number; maxAddedClients: number };

export type AssociationCaps = {
  seedRuleCodes: string[];
  maxClientsPerPrivateAccount: number;
  minDistinctLinks: number;
  maxLinkedClients: number;
  strongFlowWindowHours: number;
  strongFlowMinAmountCzk: number;
};

export type BacktestCaps = { maxClientShare: number; maxOverlapWithExistingRule: number };

export type LlmBudget = {
  enabled: boolean;
  maxToolCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxWallClockMs: number;
  maxHypotheses: number;
  maxConcurrentExplanations: number;
  maxSampleClientIds: number;
};

export type RuleReviewParams = {
  caps: RelaxationCaps;
  growthCap: GrowthCap;
  association: AssociationCaps;
  backtest: BacktestCaps;
  llm: LlmBudget;
};

export const DEFAULT_RULE_REVIEW_PARAMS: RuleReviewParams = {
  caps: {
    maxRelativeMove: { amount: 0.1, window: 0.25, ratio: 0.1 },
    stepSize: { amount: 0.025, window: 0.05, ratio: 0.025 },
    maxCountUnits: 1,
    excludedRuleCodes: ["R-01"],
    regulatoryParameters: ["R-07:b"],
    repetition: { minDistinctDays: 2, minClients: 3 },
  },
  growthCap: { minAddedClients: 5, maxRelativeGrowth: 0.25, maxAddedClients: 50 },
  association: {
    seedRuleCodes: ["R-02", "R-03", "R-04", "R-11", "R-12"],
    maxClientsPerPrivateAccount: 3,
    minDistinctLinks: 2,
    maxLinkedClients: 50,
    strongFlowWindowHours: 72,
    strongFlowMinAmountCzk: 25_000,
  },
  backtest: { maxClientShare: 0.01, maxOverlapWithExistingRule: 0.8 },
  llm: {
    enabled: false,
    maxToolCalls: 20,
    maxInputTokens: 150_000,
    maxOutputTokens: 20_000,
    maxWallClockMs: 5 * 60 * 1000,
    maxHypotheses: 5,
    maxConcurrentExplanations: 3,
    maxSampleClientIds: 10,
  },
};

export type CoverageMatrixRow = { indicator: string; label: string; ruleCodes: string[] };

export type FindingKind = "rule_adjustment" | "new_rule" | "coverage_gap" | "association";

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

export type RuleHypothesis = {
  id: string;
  // 1b proposal: a coverage gap has no definition and no backtest, only the feature it is missing.
  kind: "new_rule" | "coverage_gap";
  definition: RuleDefinition | null;
  missingFeature: string | null;
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
  explanations: Record<string, FindingExplanation>;
  hypotheses: RuleHypothesis[];
  critiques: Record<string, string>;
  calls: LlmCallAudit[];
  errors: string[];
};

export type RuleReviewReport = {
  id: string;
  status: "running" | "completed" | "failed";
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

export type ClientProfile = {
  clientId: string;
  clientType: ClientType;
  riskScore: AmlRiskScore;
  isPep: boolean;
  contractChannel: ContractChannel;
  tenureMonths: number;
  nearMissCount: number;
  minDistance: number | null;
  findingTransactionCount: number;
  findingAmountCzk: { total: number; max: number };
};

export const PROFILE_DIMENSIONS = [
  "monthlyVolumeCzk",
  "monthlyTxCount",
  "distinctCounterparties",
  "incomingShare",
  "nightShare",
  "payerCountryCount",
] as const;
export type ProfileDimension = (typeof PROFILE_DIMENSIONS)[number];

export type SegmentProfile = {
  clientType: ClientType;
  riskScore: AmlRiskScore;
  clientCount: number;
  isBelowMinimumSize: boolean;
  distributions: Record<ProfileDimension, { p50: number; p90: number; p99: number }>;
  unflaggedOutlierCount: number;
  sampleOutlierClientIds: string[];
};

// Defined in 1a's domain/ruleReview/association.ts; the explorer only serializes it.
export type CounterpartyStructure = JsonValue;

export type RuleCatalogueEntry = {
  ruleId: string;
  ruleVersionId: string;
  code: string;
  label: string;
  alertType: string;
  humanText: string;
  legalBases: { regulationCode: string; ref: string }[];
};

export interface LlmAuditLog {
  recordCall(call: LlmCallAudit): void;
  recordError(message: string): void;
}

export type FindingExplanationContext = {
  report: RuleReviewReport;
  ruleCatalogue: RuleCatalogueEntry[];
  clientProfilesByFindingId: Record<string, ClientProfile[]>;
  budget: LlmBudget;
  audit: LlmAuditLog;
};

export interface FindingExplainer {
  explain(
    findings: RuleReviewFinding[],
    context: FindingExplanationContext,
  ): Promise<Record<string, FindingExplanation>>;
  summarize(context: FindingExplanationContext): Promise<string | null>;
}

export interface RuleReviewTools {
  getRuleCatalogue(): Promise<RuleCatalogueEntry[]>;
  getFeatureCatalogue(): Promise<FeatureDescription[]>;
  getCoverageMatrix(): Promise<CoverageMatrixRow[]>;
  getGapFindings(): Promise<Omit<RuleReviewFinding, "clients">[]>;
  getSegmentProfiles(): Promise<SegmentProfile[]>;
  getCounterpartyStructure(): Promise<CounterpartyStructure>;
  backtestRule(definition: RuleDefinition): Promise<RuleBacktest>;
}

export type HypothesisExploration = {
  hypotheses: RuleHypothesis[];
  critiques: Record<string, string>;
  calls: LlmCallAudit[];
  // 1b proposal: a Bedrock failure or a budget stop in the loop; explore() has no audit log to report it to.
  errors: string[];
};

export interface HypothesisExplorer {
  explore(
    report: RuleReviewReport,
    tools: RuleReviewTools,
    budget: LlmBudget,
  ): Promise<HypothesisExploration>;
}
