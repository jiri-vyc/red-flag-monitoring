import type { AmlRiskScore } from "./client";
import { type RuleEvaluation, type RuleOutcome, type SkipReason, type Verdict } from "./evaluation";
import { calculateFeatures, UnknownFeatureError } from "./features/calculateFeatures";
import type { FeatureContext } from "./features/featureContext";
import { MissingFxRateError } from "./features/fxRates";
import type { RiskProfile } from "./rule";
import {
  evaluateRuleDefinition,
  type ReferenceListItems,
  RuleDefinitionEvaluationError,
} from "./ruleConditionEvaluation";
import type { RuleDefinition } from "./ruleDefinition";
import { MAX_SCORE } from "./score";

// A deterministic rule version fixed for a run (V5), with the rule fields the evaluation needs.
export type DeterministicRunRuleVersion = {
  ruleVersionId: string;
  ruleId: string;
  ruleCode: string;
  isWhitelistAllowed: boolean;
  definition: RuleDefinition;
  baseScore: number;
  sensitivity: number;
  riskProfiles: readonly RiskProfile[];
};

// Everything a run evaluates with, loaded once per run. Rules never query the database (D18).
export type RunRuleSet = {
  ruleVersions: readonly DeterministicRunRuleVersion[];
  referenceLists: ReferenceListItems;
  whitelistedClientIdsByRuleId: ReadonlyMap<string, ReadonlySet<string>>;
  hitThreshold: number;
};

export type RuleEvaluationResult = Omit<RuleEvaluation, "id" | "transactionEvaluationId">;

export type TransactionEvaluationResult = {
  verdict: Verdict;
  maxScore: number;
  hitCount: number;
  ruleEvaluations: RuleEvaluationResult[];
};

const EMPTY_LLM_FIELDS = { llmPrompt: null, llmResponse: null, llmModelId: null } as const;

// Runs every rule version of the set over one transaction and derives the verdict (spec/datovy-model.md,
// "Výsledek pravidla a transakce").
export function evaluateTransaction(input: {
  context: FeatureContext;
  ruleSet: RunRuleSet;
}): TransactionEvaluationResult {
  const ruleEvaluations = input.ruleSet.ruleVersions.map((ruleVersion) =>
    evaluateRuleVersion({ ruleVersion, context: input.context, ruleSet: input.ruleSet }),
  );

  return summarizeRuleEvaluations(ruleEvaluations);
}

// Used when the client context itself cannot be built, e.g. a history transaction without an FX rate.
export function createFailedTransactionEvaluation(input: {
  ruleSet: RunRuleSet;
  errorMessage: string;
}): TransactionEvaluationResult {
  const ruleEvaluations = input.ruleSet.ruleVersions.map((ruleVersion) =>
    createErrorEvaluation(ruleVersion, input.errorMessage),
  );

  return summarizeRuleEvaluations(ruleEvaluations);
}

// V7: adjusted_score = raw_score × sensitivity / 100, rounded to a whole score.
export function calculateAdjustedScore(rawScore: number, sensitivity: number): number {
  return Math.round((rawScore * sensitivity) / MAX_SCORE);
}

export function decideVerdict(outcomes: readonly RuleOutcome[]): Verdict {
  if (outcomes.includes("hit")) {
    return "flagged";
  }

  if (outcomes.includes("error")) {
    return "error";
  }

  return "pass";
}

function evaluateRuleVersion(input: {
  ruleVersion: DeterministicRunRuleVersion;
  context: FeatureContext;
  ruleSet: RunRuleSet;
}): RuleEvaluationResult {
  const { ruleVersion, context, ruleSet } = input;
  const skipReason = findSkipReason({ ruleVersion, client: context.client, ruleSet });

  if (skipReason) {
    return createNotApplicableEvaluation(ruleVersion, skipReason);
  }

  try {
    return scoreRuleVersion({ ruleVersion, context, ruleSet });
  } catch (error) {
    if (isRuleEvaluationError(error)) {
      return createErrorEvaluation(ruleVersion, error.message);
    }

    throw error;
  }
}

function findSkipReason(input: {
  ruleVersion: DeterministicRunRuleVersion;
  client: { clientId: string; amlRiskScore: AmlRiskScore };
  ruleSet: RunRuleSet;
}): SkipReason | null {
  const { ruleVersion, client } = input;
  const whitelistedClientIds = input.ruleSet.whitelistedClientIdsByRuleId.get(ruleVersion.ruleId);

  // M16: a whitelist entry of a mandatory rule must not exist; if one slipped in, it does not suppress.
  if (ruleVersion.isWhitelistAllowed && whitelistedClientIds?.has(client.clientId)) {
    return "whitelist";
  }

  if (!ruleVersion.riskProfiles.includes(client.amlRiskScore)) {
    return "risk_profile";
  }

  return null;
}

function scoreRuleVersion(input: {
  ruleVersion: DeterministicRunRuleVersion;
  context: FeatureContext;
  ruleSet: RunRuleSet;
}): RuleEvaluationResult {
  const { ruleVersion, ruleSet } = input;
  const { features, contextRefs } = calculateFeatures({
    featureIds: ruleVersion.definition.features,
    context: input.context,
  });
  const trace = evaluateRuleDefinition({
    definition: ruleVersion.definition,
    features,
    referenceLists: ruleSet.referenceLists,
  });
  const rawScore = trace.matched ? ruleVersion.baseScore : 0;
  const adjustedScore = calculateAdjustedScore(rawScore, ruleVersion.sensitivity);
  const isHit = adjustedScore >= ruleSet.hitThreshold;

  return {
    ruleVersionId: ruleVersion.ruleVersionId,
    outcome: isHit ? "hit" : "pass",
    skipReason: null,
    rawScore,
    adjustedScore,
    features,
    trace,
    // V8: only a hit keeps the transactions it was computed from.
    contextRefs: isHit ? contextRefs : [],
    ...EMPTY_LLM_FIELDS,
    errorMessage: null,
  };
}

function createNotApplicableEvaluation(
  ruleVersion: DeterministicRunRuleVersion,
  skipReason: SkipReason,
): RuleEvaluationResult {
  return createUnscoredEvaluation({ ruleVersion, outcome: "not_applicable", skipReason, errorMessage: null });
}

function createErrorEvaluation(
  ruleVersion: DeterministicRunRuleVersion,
  errorMessage: string,
): RuleEvaluationResult {
  return createUnscoredEvaluation({ ruleVersion, outcome: "error", skipReason: null, errorMessage });
}

function createUnscoredEvaluation(input: {
  ruleVersion: DeterministicRunRuleVersion;
  outcome: Exclude<RuleOutcome, "pass" | "hit">;
  skipReason: SkipReason | null;
  errorMessage: string | null;
}): RuleEvaluationResult {
  return {
    ruleVersionId: input.ruleVersion.ruleVersionId,
    outcome: input.outcome,
    skipReason: input.skipReason,
    rawScore: null,
    adjustedScore: null,
    features: null,
    trace: null,
    contextRefs: [],
    ...EMPTY_LLM_FIELDS,
    errorMessage: input.errorMessage,
  };
}

function summarizeRuleEvaluations(ruleEvaluations: RuleEvaluationResult[]): TransactionEvaluationResult {
  const outcomes = ruleEvaluations.map((ruleEvaluation) => ruleEvaluation.outcome);
  const scores = ruleEvaluations.map((ruleEvaluation) => ruleEvaluation.adjustedScore ?? 0);

  return {
    verdict: decideVerdict(outcomes),
    maxScore: Math.max(0, ...scores),
    hitCount: outcomes.filter((outcome) => outcome === "hit").length,
    ruleEvaluations,
  };
}

// Expected failures of one rule: the run records them as the rule's `error` outcome and goes on.
function isRuleEvaluationError(error: unknown): error is Error {
  return (
    error instanceof MissingFxRateError ||
    error instanceof UnknownFeatureError ||
    error instanceof RuleDefinitionEvaluationError
  );
}
