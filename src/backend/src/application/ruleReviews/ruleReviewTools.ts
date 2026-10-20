import type { RunRuleSet } from "../../domain/evaluateTransaction";
import { describeFeatureCatalog } from "../../domain/features/featureCatalog";
import type { RuleDefinition } from "../../domain/ruleDefinition";
import { describeCounterpartyStructure } from "../../domain/ruleReview/association";
import { type BacktestResult, backtestRuleDefinition } from "../../domain/ruleReview/ruleBacktest";
import type { ReviewDataset } from "../../domain/ruleReview/reviewDataset";
import type { RuleReviewParams } from "../../domain/ruleReview/ruleReviewParams";
import type { RuleReviewReport } from "../../domain/ruleReview/ruleReviewReport";
import { profileSegments } from "../../domain/ruleReview/segmentProfiles";
import { runCooperatively } from "./cooperativeRunner";
import type { DeterministicAnalysis } from "./ruleReviewAnalysis";
import type { RuleCatalogueEntry, RuleReviewTools } from "./ruleReviewPorts";

export class ToolBudgetExhaustedError extends Error {}

export type ToolContext = {
  report: RuleReviewReport;
  dataset: ReviewDataset;
  ruleSet: RunRuleSet;
  ruleCatalogue: RuleCatalogueEntry[];
  analysis: DeterministicAnalysis;
  params: RuleReviewParams;
};

// The tool call budget is enforced here, whatever the model asks for.
export function createRuleReviewTools(context: ToolContext): RuleReviewTools {
  let remainingCalls = context.params.llm.maxToolCalls;
  const spend = <T>(call: () => Promise<T>): Promise<T> => {
    if (remainingCalls <= 0) {
      return Promise.reject(
        new ToolBudgetExhaustedError(`Tool call budget of ${context.params.llm.maxToolCalls} exhausted`),
      );
    }

    remainingCalls -= 1;

    return call();
  };
  const flaggedClientIds = new Set(
    [...context.analysis.clientIdsByRuleCode.values()].flatMap((clientIds) => [...clientIds]),
  );

  return {
    getRuleCatalogue: () => spend(async () => context.ruleCatalogue),
    getFeatureCatalogue: () => spend(async () => describeFeatureCatalog()),
    getCoverageMatrix: () => spend(async () => context.analysis.coverageMatrix),
    getGapFindings: () =>
      spend(async () => context.analysis.findings.map(({ clients: _clients, ...finding }) => finding)),
    getSegmentProfiles: () =>
      spend(async () =>
        profileSegments({
          dataset: context.dataset,
          flaggedClientIds,
          maxSampleClientIds: context.params.llm.maxSampleClientIds,
        }),
      ),
    getCounterpartyStructure: () =>
      spend(async () =>
        describeCounterpartyStructure({
          dataset: context.dataset,
          accountIndex: context.analysis.accountIndex,
          seeds: context.analysis.seeds,
          caps: context.params.association,
        }),
      ),
    backtestRule: (definition) => spend(async () => (await backtestHypothesis(context, definition)).backtest),
  };
}

export function backtestHypothesis(
  context: ToolContext,
  definition: RuleDefinition,
): Promise<BacktestResult> {
  return runCooperatively(
    backtestRuleDefinition({
      dataset: context.dataset,
      definition,
      ruleSet: context.ruleSet,
      clientIdsByRuleCode: context.analysis.clientIdsByRuleCode,
      caps: context.params.backtest,
      maxSampleClientIds: context.params.llm.maxSampleClientIds,
    }),
  );
}
