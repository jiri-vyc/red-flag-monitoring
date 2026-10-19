import type {
  Bucket,
  RuleEvaluation,
  SkipReason,
  Transaction,
  TransactionEvaluation,
} from "@/features/batches/types";
import type { RiskProfile, RuleType } from "@/features/rules/types";

import { getMockClient } from "./mockClient";
import { runMockCheck, type MockCheckKind } from "./ruleChecks";

/** Snapshot of an executable rule taken when a batch starts, so later rule changes do not alter stored results. */
export type MockRuleSnapshot = {
  ruleId: string;
  ruleName: string;
  ruleType: RuleType;
  versionNumber: number;
  sensitivity: number;
  riskProfiles: RiskProfile[];
  /** Whitelist entries of the rule as they were at batch creation (not part of the version config). */
  whitelistClientIds: string[];
  checkKind: MockCheckKind;
};

// Demo thresholds. Real aggregation and thresholds are an open question (spec 10.7) and need compliance review.
export const FAILED_RULE_MIN_ADJUSTED_SCORE = 40;
export const ALERT_MIN_ADJUSTED_SCORE = 75;

type TransactionEvaluationResult = Omit<TransactionEvaluation, "batchId">;

function findSkipReason(
  rule: MockRuleSnapshot,
  clientId: string,
  riskProfile: RiskProfile,
): SkipReason | null {
  if (rule.whitelistClientIds.includes(clientId)) {
    return "whitelisted";
  }
  if (!rule.riskProfiles.includes(riskProfile)) {
    return "risk_profile_not_applicable";
  }
  return null;
}

// Proposed formula from spec 4.4: sensitivity can only lower the score.
function applySensitivity(score: number, sensitivity: number): number {
  return Math.round((score * sensitivity) / 100);
}

function calculateBucket(failedRules: RuleEvaluation[]): Bucket {
  if (failedRules.length === 0) {
    return "ok";
  }
  const maxAdjustedScore = Math.max(...failedRules.map((evaluation) => evaluation.adjustedScore));
  return maxAdjustedScore >= ALERT_MIN_ADJUSTED_SCORE ? "alert" : "to_check";
}

export function evaluateTransaction(
  transaction: Transaction,
  rules: MockRuleSnapshot[],
): TransactionEvaluationResult {
  const client = getMockClient(transaction.clientId);
  const failedRules: RuleEvaluation[] = [];
  const passedRules: RuleEvaluation[] = [];
  const skippedRules: TransactionEvaluationResult["skippedRules"] = [];

  for (const rule of rules) {
    const skipReason = findSkipReason(rule, client.id, client.riskProfile);
    if (skipReason) {
      skippedRules.push({ ruleId: rule.ruleId, ruleName: rule.ruleName, reason: skipReason });
      continue;
    }
    const checkResult = runMockCheck(rule.checkKind, { transaction, client, ruleId: rule.ruleId });
    const adjustedScore = applySensitivity(checkResult.score, rule.sensitivity);
    const isFailed = adjustedScore >= FAILED_RULE_MIN_ADJUSTED_SCORE;
    (isFailed ? failedRules : passedRules).push({
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      ruleType: rule.ruleType,
      ruleVersionNumber: rule.versionNumber,
      sensitivity: rule.sensitivity,
      score: checkResult.score,
      adjustedScore,
      isFailed,
      trace: checkResult.trace,
    });
  }

  const byAdjustedScoreDescending = (first: RuleEvaluation, second: RuleEvaluation) =>
    second.adjustedScore - first.adjustedScore;
  failedRules.sort(byAdjustedScoreDescending);
  passedRules.sort(byAdjustedScoreDescending);
  return {
    transaction,
    client: { id: client.id, riskProfile: client.riskProfile, isPep: client.isPep, country: client.country },
    bucket: calculateBucket(failedRules),
    failedRules,
    passedRules,
    skippedRules,
  };
}
