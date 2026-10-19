import type { BatchTransaction, BucketCounts, Transaction } from "@/features/batches/types";
import { findRunningVersion, isRuleExecutable } from "@/features/rules/domain/ruleLifecycle";
import type { Rule, WhitelistEntry } from "@/features/rules/types";

import { evaluateTransaction, type MockRuleSnapshot } from "./evaluateTransaction";
import type { MockCheckKind } from "./ruleChecks";

const FALLBACK_CHECK_KIND: MockCheckKind = "agentic_context";

type RuleSnapshotSource = {
  rules: Rule[];
  ruleCheckKinds: Record<string, MockCheckKind>;
  whitelistEntries: WhitelistEntry[];
};

export function createRuleSnapshots({
  rules,
  ruleCheckKinds,
  whitelistEntries,
}: RuleSnapshotSource): MockRuleSnapshot[] {
  return rules.filter(isRuleExecutable).flatMap((rule) => {
    const runningVersion = findRunningVersion(rule);
    if (!runningVersion) {
      return [];
    }
    return [
      {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        versionNumber: runningVersion.versionNumber,
        // Config always comes from the running approved version, never from a pending one.
        sensitivity: runningVersion.config.sensitivity,
        riskProfiles: runningVersion.config.riskProfiles,
        // The whitelist is copied at batch creation, so later whitelist changes do not alter past batches.
        whitelistClientIds: rule.whitelistAllowed
          ? whitelistEntries.filter((entry) => entry.ruleId === rule.id).map((entry) => entry.clientId)
          : [],
        checkKind: ruleCheckKinds[rule.id] ?? FALLBACK_CHECK_KIND,
      },
    ];
  });
}

export function evaluateBatchRows(
  transactions: Transaction[],
  ruleSnapshots: MockRuleSnapshot[],
): BatchTransaction[] {
  return transactions.map((transaction) => {
    const evaluation = evaluateTransaction(transaction, ruleSnapshots);
    const adjustedScores = evaluation.failedRules.map((ruleEvaluation) => ruleEvaluation.adjustedScore);
    return {
      transaction,
      bucket: evaluation.bucket,
      failedRuleCount: evaluation.failedRules.length,
      maxAdjustedScore: adjustedScores.length > 0 ? Math.max(...adjustedScores) : 0,
    };
  });
}

export function countBuckets(rows: BatchTransaction[]): BucketCounts {
  const counts: BucketCounts = { ok: 0, to_check: 0, alert: 0 };
  rows.forEach((row) => {
    counts[row.bucket] += 1;
  });
  return counts;
}
