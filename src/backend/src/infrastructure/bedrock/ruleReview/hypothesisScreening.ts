import type { RuleBacktest } from "../../../domain/ruleReview/ruleReviewReport";

// 1a's backtest applies the spec §4 caps (discardReason); code here adds what makes a hypothesis useless anyway.
export function findDiscardReason(backtest: RuleBacktest): string | null {
  if (backtest.violation !== null) {
    return `DSL validation failed: ${backtest.violation}`;
  }

  if (backtest.discardReason !== null) {
    return backtest.discardReason;
  }

  return backtest.clientCount === 0 ? "the rule hits no client" : null;
}

// Spec §5.3: a tool result shows the model at most this many client IDs, whatever the tool returned.
export function limitSampleClientIds(backtest: RuleBacktest, maxSampleClientIds: number): RuleBacktest {
  return { ...backtest, sampleClientIds: backtest.sampleClientIds.slice(0, maxSampleClientIds) };
}

export function formatPercent(share: number): string {
  return `${Math.round(share * 1000) / 10} %`;
}
