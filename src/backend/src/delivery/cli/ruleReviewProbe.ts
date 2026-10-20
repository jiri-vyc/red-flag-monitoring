import type { RunRuleSet } from "../../domain/evaluateTransaction";
import { DEFAULT_FEATURE_PARAMETERS } from "../../domain/features/featureParameters";
import {
  collectSeeds,
  describeCounterpartyStructure,
  indexCounterpartyAccounts,
  buildAssociationFindings,
} from "../../domain/ruleReview/association";
import { runToCompletion } from "../../domain/ruleReview/cooperativeWork";
import { type NearMiss, summarizeSweep } from "../../domain/ruleReview/parameterSweep";
import { perturbPatternHit, PERTURBED_PATTERN_WINDOWS } from "../../domain/ruleReview/perturbation";
import type { RelaxableParameter, RelaxationStep } from "../../domain/ruleReview/relaxableParameters";
import { createReviewDataset, readVolumeAsCzk } from "../../domain/ruleReview/reviewDataset";
import {
  planFeatureSweeps,
  runBaselinePass,
  sweepFeatureParameter,
  toSweepKey,
  type BaselinePass,
} from "../../domain/ruleReview/ruleGapAnalysis";
import { DEFAULT_RULE_REVIEW_PARAMS, type RelaxationCaps } from "../../domain/ruleReview/ruleReviewParams";
import type { DeterministicRunRuleVersion } from "../../domain/evaluateTransaction";
import type { EvaluationDataset } from "../../domain/transactionEvaluator";

// Steps go past the caps to show the curve; "reach" applies the real caps.
const PROBE_CAPS: RelaxationCaps = {
  ...DEFAULT_RULE_REVIEW_PARAMS.caps,
  maxRelativeMove: { amount: 0.2, window: 0.5, ratio: 0.2 },
};
const STEP_TOLERANCE = 1e-9;
const PERTURBATIONS_PER_RULE = 5;
const PERTURBATION_OVERSHOOT = 0.1;

export type ProbeMode = "fx" | "czk";

export function runProbe(input: { dataset: EvaluationDataset; ruleSet: RunRuleSet; mode: ProbeMode }): void {
  const dataset = input.mode === "czk" ? readVolumeAsCzk(input.dataset) : input.dataset;
  const startedAt = Date.now();
  const reviewDataset = createReviewDataset(dataset);
  const featureParameters = DEFAULT_FEATURE_PARAMETERS;
  const baseline = runToCompletion(
    runBaselinePass({ dataset: reviewDataset, ruleSet: input.ruleSet, featureParameters, caps: PROBE_CAPS }),
  );

  log(
    `\n## Mode ${input.mode} (${dataset.transactions.length} transactions), baseline ${elapsed(startedAt)}`,
  );
  log(
    `Base clients: ${[...baseline.hitsByRuleVersionId.values()]
      .map((hits) => `${hits.ruleVersion.ruleCode} ${hits.clientIds.size}`)
      .join(", ")}`,
  );
  log("\n| Rule | Base | Parameter (type) | Added clients per step | Reach under both caps | Outcome |");
  log("| --- | --- | --- | --- | --- | --- |");

  for (const plan of baseline.conditionSweeps) {
    const nearMisses =
      baseline.conditionNearMisses.get(toSweepKey(plan.ruleVersion.ruleVersionId, plan.parameter.key)) ?? [];
    printSweep({
      baseline,
      ruleVersion: plan.ruleVersion,
      parameter: plan.parameter,
      steps: plan.steps,
      nearMisses,
    });
  }

  for (const plan of planFeatureSweeps({ ruleSet: input.ruleSet, featureParameters, caps: PROBE_CAPS })) {
    const sweepStartedAt = Date.now();
    const baseHits = baseline.hitsByRuleVersionId.get(plan.ruleVersion.ruleVersionId);
    const nearMisses = runToCompletion(
      sweepFeatureParameter({
        dataset: reviewDataset,
        ruleSet: input.ruleSet,
        plan,
        featureParameters,
        baseHitTransactionIds: baseHits?.transactionIds ?? new Set(),
      }),
    );
    printSweep({ ...plan, baseline, nearMisses, timing: elapsed(sweepStartedAt) });
  }

  printAssociation({ baseline, reviewDataset });
  printPerturbations({ baseline, dataset, ruleSet: input.ruleSet });
  log(`\nMode ${input.mode} done in ${elapsed(startedAt)}`);
}

function printSweep(input: {
  baseline: BaselinePass;
  ruleVersion: DeterministicRunRuleVersion;
  parameter: RelaxableParameter;
  steps: RelaxationStep[];
  nearMisses: NearMiss[];
  timing?: string;
}): void {
  const baseClientIds =
    input.baseline.hitsByRuleVersionId.get(input.ruleVersion.ruleVersionId)?.clientIds ?? new Set<string>();
  const sweepInput = {
    ...input,
    baseClientIds,
    caps: DEFAULT_RULE_REVIEW_PARAMS.caps,
    growthCap: DEFAULT_RULE_REVIEW_PARAMS.growthCap,
  };
  const curve = summarizeSweep(sweepInput);
  const inCapStepCount = countStepsWithinCap(input.parameter, input.steps);
  const verdict = summarizeSweep({
    ...sweepInput,
    steps: input.steps.slice(0, inCapStepCount),
    nearMisses: input.nearMisses.filter((nearMiss) => nearMiss.stepIndex < inCapStepCount),
  });
  const reported = verdict.reportedStepIndex === null ? null : verdict.steps[verdict.reportedStepIndex];
  const reach =
    verdict.outcome === "cap_exceeded"
      ? "**blocked by growth**"
      : reported
        ? `${formatStep(reported.step)}, **+${reported.addedClients}**`
        : "none";
  const regulatory = input.parameter.isRegulatory ? ", regulatory" : "";

  log(
    `| ${input.ruleVersion.ruleCode} | ${baseClientIds.size} | ${input.parameter.key} ${input.parameter.currentValue} (${input.parameter.parameterType}${regulatory}) | ${curve.steps
      .filter((step) => step.addedClients > 0 || step === curve.steps.at(-1))
      .map((step) => `${formatStep(step.step)}: +${step.addedClients}`)
      .join(
        ", ",
      )} | ${reach} | ${verdict.outcome}${verdict.outcome === "gap" || verdict.outcome === "noise" ? ` (${verdict.clients.filter((client) => client.distinctDays >= 2).length} repeated)` : ""}${input.timing ? `, ${input.timing}` : ""} |`,
  );
}

function printAssociation(input: {
  baseline: BaselinePass;
  reviewDataset: ReturnType<typeof createReviewDataset>;
}): void {
  const caps = DEFAULT_RULE_REVIEW_PARAMS.association;
  const clientIdsByRuleCode = new Map(
    [...input.baseline.hitsByRuleVersionId.values()].map((hits) => [
      hits.ruleVersion.ruleCode,
      hits.clientIds,
    ]),
  );
  const seeds = collectSeeds({ dataset: input.reviewDataset, clientIdsByRuleCode, caps });
  const accountIndex = indexCounterpartyAccounts(input.reviewDataset);
  const structure = describeCounterpartyStructure({
    dataset: input.reviewDataset,
    accountIndex,
    seeds,
    caps,
  });
  const reasonCounts = countSeedReasons(seeds);
  const findings = buildAssociationFindings({ dataset: input.reviewDataset, accountIndex, seeds, caps });

  log(
    `\n### Association (4.1): ${structure.seedCount} seeds (${reasonCounts}), ${structure.accountCount} accounts`,
  );
  log(
    `Clients per account: median ${structure.clientsPerAccount.median}, p90 ${structure.clientsPerAccount.p90}, p99 ${structure.clientsPerAccount.p99}, max ${structure.clientsPerAccount.max}`,
  );
  log("| Link rule | Non-seed clients linked | Linked via ≥ 2 accounts |");
  log("| --- | --- | --- |");

  for (const row of structure.linkTable) {
    log(
      `| account used by ≤ ${row.maxClientsPerAccount} clients | ${row.linkedClients} | ${row.linkedViaTwoOrMoreAccounts} |`,
    );
  }

  log(
    `| strong flow seed → X → client ≤ 72 h, X private (≤ ${caps.maxClientsPerPrivateAccount}) | ${structure.strongFlowClients.privateAccounts} | |`,
  );
  log(`| strong flow through any account | ${structure.strongFlowClients.anyAccount} | |`);
  log(`Association findings under the caps: ${findings.length}`);
}

function printPerturbations(input: {
  baseline: BaselinePass;
  dataset: EvaluationDataset;
  ruleSet: RunRuleSet;
}): void {
  const clientIdByTransactionId = new Map(
    input.dataset.transactions.map((transaction) => [transaction.transactionId, transaction.clientId]),
  );

  log("\n### Perturbation test (R-04, R-11, R-12): completing payment moved 10 % past the window");

  for (const ruleCode of Object.keys(PERTURBED_PATTERN_WINDOWS)) {
    const hits = [...input.baseline.hitsByRuleVersionId.values()].find(
      (candidate) => candidate.ruleVersion.ruleCode === ruleCode,
    );

    if (!hits) {
      continue;
    }

    const hitsByClient = new Map<string, string[]>();

    for (const transactionId of hits.transactionIds) {
      const clientId = clientIdByTransactionId.get(transactionId) ?? "";
      hitsByClient.set(clientId, [...(hitsByClient.get(clientId) ?? []), transactionId]);
    }

    const singleHits = [...hitsByClient]
      .filter(([, transactionIds]) => transactionIds.length === 1)
      .sort(([left], [right]) => left.localeCompare(right));
    const results = [];

    for (const [clientId, [transactionId = ""]] of singleHits) {
      const result = perturbPatternHit({
        dataset: input.dataset,
        ruleSet: input.ruleSet,
        ruleVersion: hits.ruleVersion,
        clientId,
        transactionId,
        featureParameters: DEFAULT_FEATURE_PARAMETERS,
        caps: DEFAULT_RULE_REVIEW_PARAMS.caps,
        overshoot: PERTURBATION_OVERSHOOT,
      });

      if (result && !result.stillHitsAfterShift) {
        results.push(result);
      }

      if (results.length >= PERTURBATIONS_PER_RULE) {
        break;
      }
    }

    const detected = results.filter((result) => result.detectedAtStep !== null);
    log(
      `- ${ruleCode}: ${singleHits.length} single-hit clients, ${results.length} perturbed out of the rule, ${detected.length} found again: ${results
        .map(
          (result) =>
            `${result.clientId} +${result.shiftedHours} h → ${result.detectedAtStep === null ? "missed" : formatStep(result.detectedAtStep)}`,
        )
        .join("; ")}`,
    );
  }
}

function countStepsWithinCap(parameter: RelaxableParameter, steps: RelaxationStep[]): number {
  const caps = DEFAULT_RULE_REVIEW_PARAMS.caps;

  if (parameter.parameterType === "count") {
    return Math.min(steps.length, caps.maxCountUnits);
  }

  const maxMove =
    parameter.parameterType === "amount" ||
    parameter.parameterType === "window" ||
    parameter.parameterType === "ratio"
      ? caps.maxRelativeMove[parameter.parameterType]
      : 0;

  return steps.filter((step) => step.step <= maxMove + STEP_TOLERANCE).length;
}

function countSeedReasons(seeds: ReadonlyMap<string, readonly string[]>): string {
  const counts = new Map<string, number>();

  for (const reasons of seeds.values()) {
    for (const reason of reasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }

  return [...counts].map(([reason, count]) => `${reason} ${count}`).join(", ");
}

function formatStep(step: number): string {
  return `${Math.round(step * 1000) / 10} %`;
}

function elapsed(startedAt: number): string {
  return `${((Date.now() - startedAt) / 1000).toFixed(1)} s`;
}

function log(line: string): void {
  console.log(line);
}
