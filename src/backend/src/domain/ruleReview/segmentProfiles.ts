import type { AmlRiskScore, ClientType } from "../client";
import { getCounterpartyAccount, type PricedTransaction } from "../features/pricedTransaction";
import type { ReviewDataset } from "./reviewDataset";

// No rows leave this module: distributions, outlier counts and at most `maxSampleClientIds` IDs.

export const MIN_PEER_GROUP_SIZE = 50;
const NIGHT_END_HOUR = 6;
const OUTLIER_PERCENTILE = 0.99;
const MIN_OUTLIER_DIMENSIONS = 2;

export const PROFILE_DIMENSIONS = [
  "monthlyVolumeCzk",
  "monthlyTxCount",
  "distinctCounterparties",
  "incomingShare",
  "nightShare",
  "payerCountryCount",
] as const;
export type ProfileDimension = (typeof PROFILE_DIMENSIONS)[number];

type Distribution = { p50: number; p90: number; p99: number };

export type SegmentProfile = {
  clientType: ClientType;
  riskScore: AmlRiskScore;
  clientCount: number;
  isBelowMinimumSize: boolean;
  distributions: Record<ProfileDimension, Distribution>;
  unflaggedOutlierCount: number;
  sampleOutlierClientIds: string[];
};

type ClientMetrics = { clientId: string; values: Record<ProfileDimension, number> };

export function profileSegments(input: {
  dataset: ReviewDataset;
  flaggedClientIds: ReadonlySet<string>;
  maxSampleClientIds: number;
}): SegmentProfile[] {
  const metricsByGroup = new Map<
    string,
    { clientType: ClientType; riskScore: AmlRiskScore; metrics: ClientMetrics[] }
  >();

  for (const [clientId, history] of input.dataset.historiesByClientId) {
    const client = input.dataset.clientsById.get(clientId);

    if (!client || history.length === 0) {
      continue;
    }

    const groupKey = `${client.clientType}|${client.amlRiskScore}`;
    const group = metricsByGroup.get(groupKey) ?? {
      clientType: client.clientType,
      riskScore: client.amlRiskScore,
      metrics: [],
    };
    group.metrics.push({ clientId, values: measureClient(history) });
    metricsByGroup.set(groupKey, group);
  }

  return [...metricsByGroup.values()]
    .map((group) => toSegmentProfile(group, input))
    .sort(
      (left, right) =>
        left.clientType.localeCompare(right.clientType) || left.riskScore.localeCompare(right.riskScore),
    );
}

function measureClient(history: readonly PricedTransaction[]): Record<ProfileDimension, number> {
  const monthCount = new Set(history.map((transaction) => transaction.monthKey)).size;
  const incoming = history.filter((transaction) => transaction.transactionType === "incoming");

  return {
    monthlyVolumeCzk: Math.round(
      history.reduce((sum, transaction) => sum + transaction.amountCzk, 0) / monthCount,
    ),
    monthlyTxCount: Math.round((history.length / monthCount) * 10) / 10,
    distinctCounterparties: new Set(history.map(getCounterpartyAccount).filter((account) => account !== null))
      .size,
    incomingShare: toShare(incoming.length, history.length),
    nightShare: toShare(
      history.filter((transaction) => transaction.occurredAt.getHours() < NIGHT_END_HOUR).length,
      history.length,
    ),
    payerCountryCount: new Set(incoming.map((transaction) => transaction.payerCountry).filter(Boolean)).size,
  };
}

function toSegmentProfile(
  group: { clientType: ClientType; riskScore: AmlRiskScore; metrics: ClientMetrics[] },
  input: { flaggedClientIds: ReadonlySet<string>; maxSampleClientIds: number },
): SegmentProfile {
  const distributions = Object.fromEntries(
    PROFILE_DIMENSIONS.map((dimension) => [
      dimension,
      describeDistribution(group.metrics.map((metrics) => metrics.values[dimension])),
    ]),
  ) as Record<ProfileDimension, Distribution>;
  const outliers = group.metrics.filter(
    (metrics) =>
      !input.flaggedClientIds.has(metrics.clientId) &&
      PROFILE_DIMENSIONS.filter((dimension) => metrics.values[dimension] > distributions[dimension].p99)
        .length >= MIN_OUTLIER_DIMENSIONS,
  );

  return {
    clientType: group.clientType,
    riskScore: group.riskScore,
    clientCount: group.metrics.length,
    isBelowMinimumSize: group.metrics.length < MIN_PEER_GROUP_SIZE,
    distributions,
    unflaggedOutlierCount: outliers.length,
    sampleOutlierClientIds: outliers.slice(0, input.maxSampleClientIds).map((metrics) => metrics.clientId),
  };
}

function describeDistribution(values: number[]): Distribution {
  const sorted = [...values].sort((left, right) => left - right);
  const at = (share: number) => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0;

  return { p50: at(0.5), p90: at(0.9), p99: at(OUTLIER_PERCENTILE) };
}

function toShare(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 1000;
}
