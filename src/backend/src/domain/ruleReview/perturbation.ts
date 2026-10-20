import type { DeterministicRunRuleVersion, RunRuleSet } from "../evaluateTransaction";
import { MILLISECONDS_PER_HOUR } from "../features/calendar";
import type { FeatureParameterName, FeatureParameters } from "../features/featureParameters";
import { isOutgoingTransaction, type PricedTransaction } from "../features/pricedTransaction";
import type { EvaluationDataset } from "../transactionEvaluator";
import { runToCompletion } from "./cooperativeWork";
import { listRelaxableParameters, listRelaxationSteps, type FeatureParameter } from "./relaxableParameters";
import { createReviewDataset, evaluateReviewDataset, type ReviewDataset } from "./reviewDataset";
import { sweepFeatureParameter } from "./ruleGapAnalysis";
import type { RelaxationCaps } from "./ruleReviewParams";

type PatternWindow = {
  parameterName: FeatureParameterName;
  isPatternLeg: (candidate: PricedTransaction, completing: PricedTransaction) => boolean;
};

export const PERTURBED_PATTERN_WINDOWS: Record<string, PatternWindow> = {
  "R-04": {
    parameterName: "passthroughOutflowWindowHours",
    isPatternLeg: (candidate) => candidate.transactionType === "incoming",
  },
  "R-11": {
    parameterName: "quickForwardWindowHours",
    isPatternLeg: (candidate) => candidate.transactionType === "incoming",
  },
  "R-12": {
    parameterName: "roundTripWindowHours",
    isPatternLeg: (candidate, completing) =>
      isOutgoingTransaction(candidate) !== isOutgoingTransaction(completing),
  },
};

export type PerturbationResult = {
  ruleCode: string;
  clientId: string;
  transactionId: string;
  shiftedHours: number;
  stillHitsAfterShift: boolean;
  detectedAtStep: number | null;
};

export function perturbPatternHit(input: {
  dataset: EvaluationDataset;
  ruleSet: RunRuleSet;
  ruleVersion: DeterministicRunRuleVersion;
  clientId: string;
  transactionId: string;
  featureParameters: Readonly<FeatureParameters>;
  caps: RelaxationCaps;
  overshoot: number;
}): PerturbationResult | null {
  const patternWindow = PERTURBED_PATTERN_WINDOWS[input.ruleVersion.ruleCode];
  const clientDataset = selectClient(input.dataset, input.clientId);
  const ruleSet = { ...input.ruleSet, ruleVersions: [input.ruleVersion] };
  const hit = findHit(
    createReviewDataset(clientDataset),
    ruleSet,
    input.featureParameters,
    input.transactionId,
  );

  if (!patternWindow || !hit) {
    return null;
  }

  const legIds = new Set(hit.contextRefs);
  const latestLegMs = Math.max(
    ...hit.history
      .filter(
        (candidate) =>
          candidate.transactionId !== hit.completing.transactionId &&
          legIds.has(candidate.transactionId) &&
          patternWindow.isPatternLeg(candidate, hit.completing),
      )
      .map((candidate) => candidate.occurredAtMs),
  );

  if (!Number.isFinite(latestLegMs)) {
    return null;
  }

  const windowHours = input.featureParameters[patternWindow.parameterName];
  const completing = hit.completing;
  const shiftedAtMs = latestLegMs + windowHours * (1 + input.overshoot) * MILLISECONDS_PER_HOUR;
  const perturbed = shiftTransaction(clientDataset, input.transactionId, new Date(shiftedAtMs));
  const reviewDataset = createReviewDataset(perturbed);

  return {
    ruleCode: input.ruleVersion.ruleCode,
    clientId: input.clientId,
    transactionId: input.transactionId,
    shiftedHours: Math.round(((shiftedAtMs - completing.occurredAtMs) / MILLISECONDS_PER_HOUR) * 10) / 10,
    stillHitsAfterShift: hasHit(reviewDataset, ruleSet, input.featureParameters),
    detectedAtStep: findDetectingStep({
      ...input,
      reviewDataset,
      ruleSet,
      parameterName: patternWindow.parameterName,
    }),
  };
}

function findDetectingStep(input: {
  reviewDataset: ReviewDataset;
  ruleSet: RunRuleSet;
  ruleVersion: DeterministicRunRuleVersion;
  featureParameters: Readonly<FeatureParameters>;
  caps: RelaxationCaps;
  parameterName: FeatureParameterName;
}): number | null {
  const parameter = listRelaxableParameters(input).find(
    (candidate): candidate is FeatureParameter =>
      candidate.source === "feature" && candidate.name === input.parameterName,
  );

  if (!parameter) {
    return null;
  }

  const steps = listRelaxationSteps(parameter, input.caps);
  const nearMisses = runToCompletion(
    sweepFeatureParameter({
      dataset: input.reviewDataset,
      ruleSet: input.ruleSet,
      plan: { ruleVersion: input.ruleVersion, parameter, steps },
      featureParameters: input.featureParameters,
      baseHitTransactionIds: new Set(),
    }),
  );
  const firstStepIndex = Math.min(...nearMisses.map((nearMiss) => nearMiss.stepIndex));

  return Number.isFinite(firstStepIndex) ? (steps[firstStepIndex]?.step ?? null) : null;
}

function findHit(
  dataset: ReviewDataset,
  ruleSet: RunRuleSet,
  featureParameters: Readonly<FeatureParameters>,
  transactionId: string,
): { completing: PricedTransaction; history: readonly PricedTransaction[]; contextRefs: string[] } | null {
  let hit: {
    completing: PricedTransaction;
    history: readonly PricedTransaction[];
    contextRefs: string[];
  } | null = null;

  runToCompletion(
    evaluateReviewDataset({
      dataset,
      ruleSet,
      featureParameters,
      visit: ({ transaction, ruleEvaluations }) => {
        const ruleEvaluation = ruleEvaluations[0];

        if (transaction.transactionId === transactionId && ruleEvaluation?.outcome === "hit") {
          const history = dataset.historiesByClientId.get(transaction.clientId) ?? [];
          hit = { completing: transaction, history, contextRefs: ruleEvaluation.contextRefs };
        }
      },
    }),
  );

  return hit;
}

function hasHit(
  dataset: ReviewDataset,
  ruleSet: RunRuleSet,
  featureParameters: Readonly<FeatureParameters>,
): boolean {
  let isHit = false;

  runToCompletion(
    evaluateReviewDataset({
      dataset,
      ruleSet,
      featureParameters,
      visit: ({ ruleEvaluations }) => {
        isHit ||= ruleEvaluations.some((ruleEvaluation) => ruleEvaluation.outcome === "hit");
      },
    }),
  );

  return isHit;
}

function selectClient(dataset: EvaluationDataset, clientId: string): EvaluationDataset {
  return {
    clients: dataset.clients.filter((client) => client.clientId === clientId),
    transactions: dataset.transactions.filter((transaction) => transaction.clientId === clientId),
    fxRates: dataset.fxRates,
  };
}

function shiftTransaction(
  dataset: EvaluationDataset,
  transactionId: string,
  occurredAt: Date,
): EvaluationDataset {
  return {
    ...dataset,
    transactions: dataset.transactions.map((transaction) =>
      transaction.transactionId === transactionId ? { ...transaction, occurredAt } : transaction,
    ),
  };
}
