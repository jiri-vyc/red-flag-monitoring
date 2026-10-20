import type { DeterministicRunRuleVersion, RunRuleSet } from "../evaluateTransaction";
import type { RuleFeatures, RuleTrace } from "../evaluation";
import type { FeatureParameters } from "../features/featureParameters";
import type { PricedTransaction } from "../features/pricedTransaction";
import { evaluateRuleDefinition, type ReferenceListItems } from "../ruleConditionEvaluation";
import type { RuleDefinition } from "../ruleDefinition";
import type { CooperativeWork } from "./cooperativeWork";
import { measureConditionMargin } from "./traceMargins";
import {
  type ConditionParameter,
  type FeatureParameter,
  listRelaxableParameters,
  listRelaxationSteps,
  relaxDefinition,
  relaxFeatureParameters,
  type RelaxationStep,
} from "./relaxableParameters";
import { evaluateReviewDataset, type ReviewDataset } from "./reviewDataset";
import type { NearMiss } from "./parameterSweep";
import type { RelaxationCaps } from "./ruleReviewParams";

export type RuleHits = {
  ruleVersion: DeterministicRunRuleVersion;
  clientIds: Set<string>;
  transactionIds: Set<string>;
};

export type BaselinePass = {
  hitsByRuleVersionId: Map<string, RuleHits>;
  conditionNearMisses: Map<string, NearMiss[]>;
  conditionSweeps: ConditionSweepPlan[];
};

export type ConditionSweepPlan = {
  ruleVersion: DeterministicRunRuleVersion;
  parameter: ConditionParameter;
  steps: RelaxationStep[];
  relaxedDefinitions: RuleDefinition[];
};

export type FeatureSweepPlan = {
  ruleVersion: DeterministicRunRuleVersion;
  parameter: FeatureParameter;
  steps: RelaxationStep[];
};

export function toSweepKey(ruleVersionId: string, parameterKey: string): string {
  return `${ruleVersionId}|${parameterKey}`;
}

export function listReviewedRuleVersions(
  ruleSet: RunRuleSet,
  caps: RelaxationCaps,
): DeterministicRunRuleVersion[] {
  return ruleSet.ruleVersions.filter((ruleVersion) => !caps.excludedRuleCodes.includes(ruleVersion.ruleCode));
}

export function planConditionSweeps(input: {
  ruleSet: RunRuleSet;
  featureParameters: Readonly<FeatureParameters>;
  caps: RelaxationCaps;
}): ConditionSweepPlan[] {
  return listReviewedRuleVersions(input.ruleSet, input.caps).flatMap((ruleVersion) =>
    listRelaxableParameters({ ruleVersion, featureParameters: input.featureParameters, caps: input.caps })
      .filter((parameter): parameter is ConditionParameter => parameter.source === "condition")
      .map((parameter) => {
        const steps = listRelaxationSteps(parameter, input.caps);

        return {
          ruleVersion,
          parameter,
          steps,
          relaxedDefinitions: steps.map((step) =>
            relaxDefinition(ruleVersion.definition, parameter, step.value),
          ),
        };
      })
      .filter((plan) => plan.steps.length > 0),
  );
}

export function planFeatureSweeps(input: {
  ruleSet: RunRuleSet;
  featureParameters: Readonly<FeatureParameters>;
  caps: RelaxationCaps;
}): FeatureSweepPlan[] {
  return listReviewedRuleVersions(input.ruleSet, input.caps).flatMap((ruleVersion) =>
    listRelaxableParameters({ ruleVersion, featureParameters: input.featureParameters, caps: input.caps })
      .filter((parameter): parameter is FeatureParameter => parameter.source === "feature")
      .map((parameter) => ({ ruleVersion, parameter, steps: listRelaxationSteps(parameter, input.caps) }))
      .filter((plan) => plan.steps.length > 0),
  );
}

export function* runBaselinePass(input: {
  dataset: ReviewDataset;
  ruleSet: RunRuleSet;
  featureParameters: Readonly<FeatureParameters>;
  caps: RelaxationCaps;
}): CooperativeWork<BaselinePass> {
  const conditionSweeps = planConditionSweeps(input);
  const sweepsByRuleVersionId = groupPlansByRuleVersion(conditionSweeps);
  const hitsByRuleVersionId = new Map(
    input.ruleSet.ruleVersions.map((ruleVersion) => [
      ruleVersion.ruleVersionId,
      { ruleVersion, clientIds: new Set<string>(), transactionIds: new Set<string>() },
    ]),
  );
  const conditionNearMisses = new Map<string, NearMiss[]>();

  yield* evaluateReviewDataset({
    dataset: input.dataset,
    ruleSet: input.ruleSet,
    featureParameters: input.featureParameters,
    visit: ({ transaction, ruleEvaluations }) => {
      for (const ruleEvaluation of ruleEvaluations) {
        if (ruleEvaluation.outcome === "hit") {
          const ruleHits = hitsByRuleVersionId.get(ruleEvaluation.ruleVersionId);
          ruleHits?.clientIds.add(transaction.clientId);
          ruleHits?.transactionIds.add(transaction.transactionId);
          continue;
        }

        if (
          ruleEvaluation.outcome === "pass" &&
          ruleEvaluation.features &&
          !isMatchedTrace(ruleEvaluation.trace)
        ) {
          for (const plan of sweepsByRuleVersionId.get(ruleEvaluation.ruleVersionId) ?? []) {
            const nearMiss = findConditionNearMiss({
              plan,
              transaction,
              features: ruleEvaluation.features,
              referenceLists: input.ruleSet.referenceLists,
            });

            if (nearMiss) {
              appendNearMiss(
                conditionNearMisses,
                toSweepKey(plan.ruleVersion.ruleVersionId, plan.parameter.key),
                nearMiss,
              );
            }
          }
        }
      }
    },
  });

  return { hitsByRuleVersionId, conditionNearMisses, conditionSweeps };
}

export function* sweepFeatureParameter(input: {
  dataset: ReviewDataset;
  ruleSet: RunRuleSet;
  plan: FeatureSweepPlan;
  featureParameters: Readonly<FeatureParameters>;
  baseHitTransactionIds: ReadonlySet<string>;
  clientIds?: ReadonlySet<string>;
}): CooperativeWork<NearMiss[]> {
  const { plan } = input;
  const ruleSet: RunRuleSet = { ...input.ruleSet, ruleVersions: [plan.ruleVersion] };
  const nearMissesByTransactionId = new Map<string, NearMiss>();

  for (const [stepIndex, step] of plan.steps.entries()) {
    yield* evaluateReviewDataset({
      dataset: input.dataset,
      ruleSet,
      featureParameters: relaxFeatureParameters(input.featureParameters, plan.parameter, step.value),
      clientIds: input.clientIds,
      visit: ({ transaction, ruleEvaluations }) => {
        const isHit = ruleEvaluations.some((ruleEvaluation) => ruleEvaluation.outcome === "hit");
        const transactionId = transaction.transactionId;

        if (
          isHit &&
          !input.baseHitTransactionIds.has(transactionId) &&
          !nearMissesByTransactionId.has(transactionId)
        ) {
          nearMissesByTransactionId.set(
            transactionId,
            toNearMiss(transaction, stepIndex, { distance: step.step, observedValue: null }),
          );
        }
      },
    });
  }

  return [...nearMissesByTransactionId.values()];
}

function findConditionNearMiss(input: {
  plan: ConditionSweepPlan;
  transaction: PricedTransaction;
  features: RuleFeatures;
  referenceLists: ReferenceListItems;
}): NearMiss | null {
  const { plan, features, referenceLists } = input;
  const matchesAt = (stepIndex: number) => {
    const definition = plan.relaxedDefinitions[stepIndex];

    return definition ? evaluateRuleDefinition({ definition, features, referenceLists }).matched : false;
  };

  if (!matchesAt(plan.steps.length - 1)) {
    return null;
  }

  const stepIndex = plan.steps.findIndex((_, index) => matchesAt(index));
  const margin = measureConditionMargin({
    definition: plan.ruleVersion.definition,
    conditionId: plan.parameter.conditionId,
    features,
    referenceLists,
  });

  return toNearMiss(input.transaction, stepIndex, {
    distance: margin.distance ?? plan.steps[stepIndex]?.step ?? 0,
    observedValue: margin.observedValue,
  });
}

// A matched trace that passes only on a low sensitivity is no near miss of any constant.
function isMatchedTrace(trace: RuleTrace | null): boolean {
  return trace !== null && "matched" in trace && trace.matched;
}

function toNearMiss(
  transaction: PricedTransaction,
  stepIndex: number,
  margin: { distance: number; observedValue: number | null },
): NearMiss {
  return {
    clientId: transaction.clientId,
    transactionId: transaction.transactionId,
    dateKey: transaction.dateKey,
    stepIndex,
    ...margin,
  };
}

function groupPlansByRuleVersion(plans: ConditionSweepPlan[]): Map<string, ConditionSweepPlan[]> {
  const plansByRuleVersionId = new Map<string, ConditionSweepPlan[]>();

  for (const plan of plans) {
    const rulePlans = plansByRuleVersionId.get(plan.ruleVersion.ruleVersionId) ?? [];
    rulePlans.push(plan);
    plansByRuleVersionId.set(plan.ruleVersion.ruleVersionId, rulePlans);
  }

  return plansByRuleVersionId;
}

function appendNearMiss(nearMissesByKey: Map<string, NearMiss[]>, key: string, nearMiss: NearMiss): void {
  const nearMisses = nearMissesByKey.get(key) ?? [];
  nearMisses.push(nearMiss);
  nearMissesByKey.set(key, nearMisses);
}
