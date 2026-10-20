import type { Client } from "../../client";
import type { DeterministicRunRuleVersion, RunRuleSet } from "../../evaluateTransaction";
import type { RuleCondition, RuleDefinition } from "../../ruleDefinition";
import type { Transaction } from "../../transaction";
import { createReviewDataset, type ReviewDataset } from "../reviewDataset";

export function compare(
  id: string,
  feature: string,
  op: RuleCondition["op"],
  right: RuleCondition["right"],
): RuleCondition {
  return { id, label: `Podmínka ${id}`, left: { feature }, op, right };
}

export function buildRuleVersion(code: string, definition: RuleDefinition): DeterministicRunRuleVersion {
  return {
    ruleVersionId: `rule-version-${code}`,
    ruleId: `rule-${code}`,
    ruleCode: code,
    isWhitelistAllowed: true,
    definition,
    baseScore: 80,
    sensitivity: 100,
    riskProfiles: ["low", "medium", "high"],
  };
}

export function buildRuleSet(ruleVersions: DeterministicRunRuleVersion[]): RunRuleSet {
  return {
    ruleVersions,
    referenceLists: new Map(),
    whitelistedClientIdsByRuleId: new Map(),
    hitThreshold: 50,
  };
}

export function buildReviewDataset(clients: Client[], transactions: Transaction[]): ReviewDataset {
  return createReviewDataset({ clients, transactions, fxRates: [] });
}

export const AMOUNT_RULE = buildRuleVersion("R-AMT", {
  match: "all",
  features: ["tx_amount_czk"],
  conditions: [compare("a", "tx_amount_czk", ">=", { value: 100_000 })],
});

export const ROUND_TRIP_RULE = buildRuleVersion("R-12", {
  match: "all",
  features: ["round_trip_match_count_72h"],
  conditions: [compare("a", "round_trip_match_count_72h", ">=", { value: 1 })],
});
