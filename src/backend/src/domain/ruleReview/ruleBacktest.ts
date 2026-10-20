import { AML_RISK_SCORES, type AmlRiskScore, CLIENT_TYPES, type ClientType } from "../client";
import type { DeterministicRunRuleVersion, RunRuleSet } from "../evaluateTransaction";
import type { RuleDefinition } from "../ruleDefinition";
import { findRuleDefinitionViolation } from "../ruleDefinitionValidation";
import type { CooperativeWork } from "./cooperativeWork";
import { evaluateReviewDataset, type ReviewDataset } from "./reviewDataset";
import type { BacktestCaps } from "./ruleReviewParams";
import type { RuleBacktest } from "./ruleReviewReport";

const HYPOTHESIS_RULE_CODE = "HYPOTHESIS";
const FULL_SCORE = 100;

export type BacktestResult = {
  backtest: RuleBacktest;
  // Never handed to the model (spec 5.3).
  transactionIdsByClientId: Map<string, string[]>;
};

export function* backtestRuleDefinition(input: {
  dataset: ReviewDataset;
  definition: RuleDefinition;
  ruleSet: RunRuleSet;
  clientIdsByRuleCode: ReadonlyMap<string, ReadonlySet<string>>;
  caps: BacktestCaps;
  maxSampleClientIds: number;
}): CooperativeWork<BacktestResult> {
  const violation = findRuleDefinitionViolation(input.definition);

  if (violation) {
    return {
      backtest: { ...emptyBacktest(), violation, discardReason: `DSL validation failed: ${violation}` },
      transactionIdsByClientId: new Map(),
    };
  }

  const transactionIdsByClientId = new Map<string, string[]>();
  const errorMessages = new Set<string>();
  let hitCount = 0;

  yield* evaluateReviewDataset({
    dataset: input.dataset,
    ruleSet: { ...input.ruleSet, ruleVersions: [toHypothesisRuleVersion(input.definition)] },
    visit: ({ transaction, ruleEvaluations }) => {
      for (const ruleEvaluation of ruleEvaluations) {
        if (ruleEvaluation.outcome === "hit") {
          hitCount += 1;
          transactionIdsByClientId.set(transaction.clientId, [
            ...(transactionIdsByClientId.get(transaction.clientId) ?? []),
            transaction.transactionId,
          ]);
        } else if (ruleEvaluation.outcome === "error" && ruleEvaluation.errorMessage) {
          errorMessages.add(ruleEvaluation.errorMessage);
        }
      }
    },
  });

  const hitClientIds = new Set(transactionIdsByClientId.keys());
  const clientCount = hitClientIds.size;
  const overlapByRuleCode = measureOverlap(hitClientIds, input.clientIdsByRuleCode);
  const maxOverlap = findMaxOverlap(overlapByRuleCode, input.caps.overlapIgnoredRuleCodes);
  const totalClients = input.dataset.clientsById.size;
  const backtest: RuleBacktest = {
    violation: null,
    hitCount,
    clientCount,
    clientShare: totalClients === 0 ? 0 : roundShare(clientCount / totalClients),
    overlapByRuleCode,
    maxOverlap,
    clientsByRiskScore: countBy(
      hitClientIds,
      input.dataset,
      AML_RISK_SCORES,
      (client) => client.amlRiskScore,
    ),
    clientsByClientType: countBy(hitClientIds, input.dataset, CLIENT_TYPES, (client) => client.clientType),
    sampleClientIds: [...hitClientIds].sort().slice(0, input.maxSampleClientIds),
    discardReason: null,
  };

  return {
    backtest: {
      ...backtest,
      discardReason: findDiscardReason(backtest, [...errorMessages], input.caps, totalClients),
    },
    transactionIdsByClientId,
  };
}

function findDiscardReason(
  backtest: RuleBacktest,
  errorMessages: string[],
  caps: BacktestCaps,
  totalClients: number,
): string | null {
  if (backtest.clientCount === 0) {
    return errorMessages.length > 0 ? `Evaluation failed: ${errorMessages[0]}` : "Hits no client";
  }

  const maxClients = Math.floor(caps.maxClientShare * totalClients);

  if (backtest.clientCount > maxClients) {
    return `Hits ${backtest.clientCount} clients, more than the cap of ${maxClients}`;
  }

  if (backtest.maxOverlap && backtest.maxOverlap.share >= caps.maxOverlapWithExistingRule) {
    return `${Math.round(backtest.maxOverlap.share * 100)} % of its clients are already hit by ${backtest.maxOverlap.ruleCode}`;
  }

  return null;
}

function toHypothesisRuleVersion(definition: RuleDefinition): DeterministicRunRuleVersion {
  return {
    ruleVersionId: HYPOTHESIS_RULE_CODE,
    ruleId: HYPOTHESIS_RULE_CODE,
    ruleCode: HYPOTHESIS_RULE_CODE,
    isWhitelistAllowed: false,
    definition,
    baseScore: FULL_SCORE,
    sensitivity: FULL_SCORE,
    riskProfiles: [...AML_RISK_SCORES],
  };
}

function measureOverlap(
  hitClientIds: ReadonlySet<string>,
  clientIdsByRuleCode: ReadonlyMap<string, ReadonlySet<string>>,
): Record<string, number> {
  if (hitClientIds.size === 0) {
    return {};
  }

  return Object.fromEntries(
    [...clientIdsByRuleCode].map(([ruleCode, ruleClientIds]) => {
      const sharedClients = [...hitClientIds].filter((clientId) => ruleClientIds.has(clientId)).length;

      return [ruleCode, roundShare(sharedClients / hitClientIds.size)];
    }),
  );
}

function findMaxOverlap(
  overlapByRuleCode: Record<string, number>,
  ignoredRuleCodes: readonly string[],
): RuleBacktest["maxOverlap"] {
  const [ruleCode, share] =
    Object.entries(overlapByRuleCode)
      .filter(([candidateRuleCode]) => !ignoredRuleCodes.includes(candidateRuleCode))
      .sort(([, left], [, right]) => right - left)[0] ?? [];

  return ruleCode !== undefined && share !== undefined ? { ruleCode, share } : null;
}

function countBy<Key extends string>(
  clientIds: ReadonlySet<string>,
  dataset: ReviewDataset,
  keys: readonly Key[],
  toKey: (client: { amlRiskScore: AmlRiskScore; clientType: ClientType }) => Key,
): Record<Key, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;

  for (const clientId of clientIds) {
    const client = dataset.clientsById.get(clientId);

    if (client) {
      counts[toKey(client)] += 1;
    }
  }

  return counts;
}

function emptyBacktest(): RuleBacktest {
  return {
    violation: null,
    hitCount: 0,
    clientCount: 0,
    clientShare: 0,
    overlapByRuleCode: {},
    maxOverlap: null,
    clientsByRiskScore: { low: 0, medium: 0, high: 0 },
    clientsByClientType: { natural_person: 0, entrepreneur: 0, legal_entity: 0 },
    sampleClientIds: [],
    discardReason: null,
  };
}

function roundShare(value: number): number {
  return Math.round(value * 1000) / 1000;
}
