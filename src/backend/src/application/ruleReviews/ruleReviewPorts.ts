import type { RunRuleSet } from "../../domain/evaluateTransaction";
import type { FeatureDescription } from "../../domain/features/featureCatalog";
import type { RuleDefinition } from "../../domain/ruleDefinition";
import type { ClientProfile } from "../../domain/ruleReview/clientProfiles";
import type { CounterpartyStructure } from "../../domain/ruleReview/association";
import type { SegmentProfile } from "../../domain/ruleReview/segmentProfiles";
import type { LlmBudget } from "../../domain/ruleReview/ruleReviewParams";
import type {
  CoverageMatrixRow,
  FindingExplanation,
  LlmCallAudit,
  RuleBacktest,
  RuleHypothesis,
  RuleReviewFinding,
  RuleReviewReport,
} from "../../domain/ruleReview/ruleReviewReport";
import type { EvaluationDataset } from "../../domain/transactionEvaluator";

export interface RuleReviewReportStore {
  save(report: RuleReviewReport): Promise<void>;
  find(id: string): Promise<RuleReviewReport | null>;
  list(): Promise<RuleReviewReport[]>;
}

export interface RuleReviewLauncher {
  launchReview(reviewId: string): Promise<void>;
}

export type RuleCatalogueEntry = {
  ruleId: string;
  ruleVersionId: string;
  code: string;
  label: string;
  alertType: string;
  humanText: string;
  legalBases: { regulationCode: string; ref: string }[];
};

export type RuleReviewRuleSet = {
  ruleSet: RunRuleSet;
  ruleVersionIds: string[];
  referenceListVersionIds: string[];
};

export interface RuleReviewInputRepository {
  loadRuleSet(input: { evaluationRunId: string | null; hitThreshold: number }): Promise<RuleReviewRuleSet>;
  loadRuleCatalogue(ruleVersionIds: string[]): Promise<RuleCatalogueEntry[]>;
  loadDataset(): Promise<EvaluationDataset>;
  listTransactionIds(): Promise<string[]>;
}

export interface LlmAuditLog {
  recordCall(call: LlmCallAudit): void;
  recordError(message: string): void;
}

export type FindingExplanationContext = {
  report: RuleReviewReport;
  ruleCatalogue: RuleCatalogueEntry[];
  // At most 10 clients per finding, as aggregates, never histories (spec 5.3).
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
  errors: string[];
};

export interface HypothesisExplorer {
  explore(
    report: RuleReviewReport,
    tools: RuleReviewTools,
    budget: LlmBudget,
  ): Promise<HypothesisExploration>;
}
