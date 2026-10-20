import type { RunRuleSet } from "../../domain/evaluateTransaction";
import { DEFAULT_FEATURE_PARAMETERS } from "../../domain/features/featureParameters";
import {
  type AccountIndex,
  buildAssociationFindings,
  collectSeeds,
  indexCounterpartyAccounts,
  type SeedReasons,
} from "../../domain/ruleReview/association";
import { buildCoverageMatrix } from "../../domain/ruleReview/coverageMatrix";
import { TRANSACTIONS_PER_YIELD } from "../../domain/ruleReview/cooperativeWork";
import { summarizeSweep, toSweepFinding } from "../../domain/ruleReview/parameterSweep";
import type { ReviewDataset } from "../../domain/ruleReview/reviewDataset";
import {
  type BaselinePass,
  planFeatureSweeps,
  runBaselinePass,
  sweepFeatureParameter,
  toSweepKey,
} from "../../domain/ruleReview/ruleGapAnalysis";
import type { RuleReviewParams } from "../../domain/ruleReview/ruleReviewParams";
import type { CoverageMatrixRow, RuleReviewFinding } from "../../domain/ruleReview/ruleReviewReport";
import { runCooperatively } from "./cooperativeRunner";

export type ReviewProgress = (progress: { stage: string; done: number; total: number }) => Promise<void>;

export type DeterministicAnalysis = {
  findings: RuleReviewFinding[];
  coverageMatrix: CoverageMatrixRow[];
  clientIdsByRuleCode: Map<string, Set<string>>;
  seeds: SeedReasons;
  accountIndex: AccountIndex;
};

export async function analyzeRuleGaps(input: {
  dataset: ReviewDataset;
  ruleSet: RunRuleSet;
  ruleLabels: ReadonlyMap<string, string>;
  params: RuleReviewParams;
  reportProgress: ReviewProgress;
}): Promise<DeterministicAnalysis> {
  const { dataset, ruleSet, params, reportProgress } = input;
  const featureParameters = DEFAULT_FEATURE_PARAMETERS;
  const labelOf = (ruleVersionId: string, ruleCode: string) =>
    input.ruleLabels.get(ruleVersionId) ?? ruleCode;

  await reportProgress({ stage: "baseline", done: 0, total: dataset.transactionCount });
  const baseline = await runCooperatively(
    runBaselinePass({ dataset, ruleSet, featureParameters, caps: params.caps }),
    (chunks) =>
      reportProgress({
        stage: "baseline",
        done: Math.min(dataset.transactionCount, chunks * TRANSACTIONS_PER_YIELD),
        total: dataset.transactionCount,
      }),
  );
  const findings = buildConditionFindings(baseline, params, labelOf);
  const featurePlans = planFeatureSweeps({ ruleSet, featureParameters, caps: params.caps });

  for (const [planIndex, plan] of featurePlans.entries()) {
    await reportProgress({ stage: "feature_sweeps", done: planIndex, total: featurePlans.length });
    const ruleHits = baseline.hitsByRuleVersionId.get(plan.ruleVersion.ruleVersionId);
    const nearMisses = await runCooperatively(
      sweepFeatureParameter({
        dataset,
        ruleSet,
        plan,
        featureParameters,
        baseHitTransactionIds: ruleHits?.transactionIds ?? new Set(),
      }),
    );
    const sweep = summarizeSweep({
      ...plan,
      baseClientIds: ruleHits?.clientIds ?? new Set(),
      nearMisses,
      caps: params.caps,
      growthCap: params.growthCap,
    });
    const finding = toSweepFinding(
      sweep,
      labelOf(plan.ruleVersion.ruleVersionId, plan.ruleVersion.ruleCode),
      () => null,
    );

    if (finding) {
      findings.push(finding);
    }
  }

  await reportProgress({ stage: "association", done: 0, total: 1 });
  const clientIdsByRuleCode = new Map(
    [...baseline.hitsByRuleVersionId.values()].map((hits) => [hits.ruleVersion.ruleCode, hits.clientIds]),
  );
  const seeds = collectSeeds({ dataset, clientIdsByRuleCode, caps: params.association });
  const accountIndex = indexCounterpartyAccounts(dataset);
  const associationFindings = buildAssociationFindings({
    dataset,
    accountIndex,
    seeds,
    caps: params.association,
  });

  return {
    findings: [...sortRuleFindings(findings), ...associationFindings],
    coverageMatrix: buildCoverageMatrix(ruleSet.ruleVersions.map((ruleVersion) => ruleVersion.ruleCode)),
    clientIdsByRuleCode,
    seeds,
    accountIndex,
  };
}

function buildConditionFindings(
  baseline: BaselinePass,
  params: RuleReviewParams,
  labelOf: (ruleVersionId: string, ruleCode: string) => string,
): RuleReviewFinding[] {
  return baseline.conditionSweeps.flatMap((plan) => {
    const ruleHits = baseline.hitsByRuleVersionId.get(plan.ruleVersion.ruleVersionId);
    const sweep = summarizeSweep({
      ...plan,
      baseClientIds: ruleHits?.clientIds ?? new Set(),
      nearMisses:
        baseline.conditionNearMisses.get(toSweepKey(plan.ruleVersion.ruleVersionId, plan.parameter.key)) ??
        [],
      caps: params.caps,
      growthCap: params.growthCap,
    });
    const finding = toSweepFinding(
      sweep,
      labelOf(plan.ruleVersion.ruleVersionId, plan.ruleVersion.ruleCode),
      (stepIndex) => {
        const definition = plan.relaxedDefinitions[stepIndex];

        return definition ? { definition } : null;
      },
    );

    return finding ? [finding] : [];
  });
}

function sortRuleFindings(findings: RuleReviewFinding[]): RuleReviewFinding[] {
  return [...findings].sort(
    (left, right) =>
      (left.rule?.code ?? "").localeCompare(right.rule?.code ?? "") || left.id.localeCompare(right.id),
  );
}
