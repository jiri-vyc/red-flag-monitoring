import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { AML_RISK_SCORES, CLIENT_TYPES } from "../../../../domain/client";
import { describeFeatureCatalog } from "../../../../domain/features/featureCatalog";
import { isConditionGroup, listConditionNodes, type RuleDefinition } from "../../../../domain/ruleDefinition";
import type {
  RuleCatalogueEntry,
  RuleReviewTools,
} from "../../../../application/ruleReviews/ruleReviewPorts";
import type { CounterpartyStructure } from "../../../../domain/ruleReview/association";
import type { ClientProfile } from "../../../../domain/ruleReview/clientProfiles";
import type { RuleBacktest, RuleReviewReport } from "../../../../domain/ruleReview/ruleReviewReport";
import {
  PROFILE_DIMENSIONS,
  type ProfileDimension,
  type SegmentProfile,
} from "../../../../domain/ruleReview/segmentProfiles";
import type { FixtureClient, FixtureDataset, FixtureTransaction } from "./fixtureDataset";

// Fixture-only stand-ins for 1a's tools. backtestRule is a hash of the definition, not an evaluation.

const MIN_PEER_GROUP_SIZE = 50;
const NIGHT_END_HOUR = 6;
const OUTLIER_PERCENTILE = 0.99;
const MIN_OUTLIER_DIMENSIONS = 2;
const MAX_PROFILED_CLIENTS = 10;
const AS_OF = new Date(Date.UTC(2026, 6, 31));
const FAKE_BACKTEST_CLIENT_SPREAD = 140;
const FAKE_MAX_OVERLAP_SHARE = 0.95;

const COUNTERPARTY_STRUCTURE: CounterpartyStructure = {
  accountCount: 5380,
  clientsPerAccount: { median: 9, p90: 75, p99: 1311, max: 1372 },
  seedCount: 477,
  linkTable: [
    { maxClientsPerAccount: 2, linkedClients: 60, linkedViaTwoOrMoreAccounts: 1 },
    { maxClientsPerAccount: 3, linkedClients: 192, linkedViaTwoOrMoreAccounts: 5 },
    { maxClientsPerAccount: 5, linkedClients: 834, linkedViaTwoOrMoreAccounts: 80 },
    { maxClientsPerAccount: 10, linkedClients: 2735, linkedViaTwoOrMoreAccounts: 931 },
    { maxClientsPerAccount: 50, linkedClients: 5013, linkedViaTwoOrMoreAccounts: 4989 },
  ],
  strongFlowClients: { privateAccounts: 1, anyAccount: 1969 },
};

export function loadRuleCatalogue(ruleCatalogueJsonPath: string): RuleCatalogueEntry[] {
  return JSON.parse(readFileSync(ruleCatalogueJsonPath, "utf8")) as RuleCatalogueEntry[];
}

export function createFixtureRuleReviewTools(
  report: RuleReviewReport,
  ruleCatalogue: RuleCatalogueEntry[],
  dataset: FixtureDataset,
): RuleReviewTools {
  const clients = [...dataset.clientsById.values()];

  return {
    getRuleCatalogue: async () => ruleCatalogue,
    getFeatureCatalogue: async () => describeFeatureCatalog(),
    getCoverageMatrix: async () => report.coverageMatrix,
    getGapFindings: async () => report.findings.map(({ clients: _clients, ...finding }) => finding),
    getSegmentProfiles: async () => profileSegments(dataset, report.params.llm.maxSampleClientIds),
    getCounterpartyStructure: async () => COUNTERPARTY_STRUCTURE,
    backtestRule: async (definition) => fakeBacktest(definition, report, ruleCatalogue, clients),
  };
}

export function profileFindingClients(
  report: RuleReviewReport,
  dataset: FixtureDataset,
): Record<string, ClientProfile[]> {
  return Object.fromEntries(
    report.findings.map((finding) => [
      finding.id,
      finding.clients.slice(0, MAX_PROFILED_CLIENTS).flatMap((findingClient) => {
        const client = dataset.clientsById.get(findingClient.clientId);
        const transactionIds = new Set(findingClient.transactionIds);
        const amounts = (dataset.transactionsByClientId.get(findingClient.clientId) ?? [])
          .filter(({ transactionId }) => transactionIds.has(transactionId))
          .map(({ amountCzk }) => amountCzk);

        return client
          ? [
              {
                clientId: client.clientId,
                clientType: client.clientType,
                riskScore: client.riskScore,
                isPep: client.isPep,
                contractChannel: client.contractChannel,
                tenureMonths: countFullMonths(client.contractDate, AS_OF),
                nearMissCount: findingClient.nearMissCount,
                minDistance: findingClient.minDistance,
                findingTransactionCount: amounts.length,
                findingAmountCzk: {
                  total: round(amounts.reduce((sum, amount) => sum + amount, 0)),
                  max: Math.max(0, ...amounts),
                },
              },
            ]
          : [];
      }),
    ]),
  );
}

function profileSegments(dataset: FixtureDataset, maxSampleClientIds: number): SegmentProfile[] {
  return CLIENT_TYPES.flatMap((clientType) =>
    AML_RISK_SCORES.map((riskScore) => {
      const metrics = [...dataset.clientsById.values()]
        .filter((client) => client.clientType === clientType && client.riskScore === riskScore)
        .map((client) => ({
          clientId: client.clientId,
          values: measureClient(dataset.transactionsByClientId.get(client.clientId) ?? []),
        }));
      const distributions = Object.fromEntries(
        PROFILE_DIMENSIONS.map((dimension) => [
          dimension,
          describeDistribution(metrics.map(({ values }) => values[dimension])),
        ]),
      ) as SegmentProfile["distributions"];
      const outlierClientIds = metrics
        .filter(
          ({ values }) =>
            PROFILE_DIMENSIONS.filter((dimension) => values[dimension] > distributions[dimension].p99)
              .length >= MIN_OUTLIER_DIMENSIONS,
        )
        .map(({ clientId }) => clientId);

      return {
        clientType,
        riskScore,
        clientCount: metrics.length,
        isBelowMinimumSize: metrics.length < MIN_PEER_GROUP_SIZE,
        distributions,
        unflaggedOutlierCount: outlierClientIds.length,
        sampleOutlierClientIds: outlierClientIds.slice(0, maxSampleClientIds),
      };
    }),
  );
}

function measureClient(transactions: FixtureTransaction[]): Record<ProfileDimension, number> {
  const incoming = transactions.filter(({ isIncoming }) => isIncoming);
  const count = Math.max(1, transactions.length);

  return {
    monthlyVolumeCzk: round(transactions.reduce((sum, { amountCzk }) => sum + amountCzk, 0)),
    monthlyTxCount: transactions.length,
    distinctCounterparties: new Set(transactions.map(({ counterpartyAccount }) => counterpartyAccount)).size,
    incomingShare: round(incoming.length / count),
    nightShare: round(
      transactions.filter(({ occurredAt }) => occurredAt.getUTCHours() < NIGHT_END_HOUR).length / count,
    ),
    payerCountryCount: new Set(incoming.map(({ payerCountry }) => payerCountry)).size,
  };
}

function describeDistribution(values: number[]): { p50: number; p90: number; p99: number } {
  const sorted = values.toSorted((first, second) => first - second);
  const percentile = (share: number) =>
    round(sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0);

  return { p50: percentile(0.5), p90: percentile(0.9), p99: percentile(OUTLIER_PERCENTILE) };
}

function fakeBacktest(
  definition: RuleDefinition,
  report: RuleReviewReport,
  ruleCatalogue: RuleCatalogueEntry[],
  clients: FixtureClient[],
): RuleBacktest {
  const digest = createHash("sha256").update(JSON.stringify(definition)).digest();
  const leafConditionCount = listConditionNodes(definition.conditions).filter(
    (node) => !isConditionGroup(node),
  ).length;
  const clientCount = Math.floor(
    (digest.readUInt16BE(0) % FAKE_BACKTEST_CLIENT_SPREAD) / Math.max(1, leafConditionCount),
  );
  const step = 1 + (digest.readUInt16BE(2) % 97);
  const matchedClients = Array.from(
    { length: clientCount },
    (_, index) => clients[(index * step + digest.readUInt8(4)) % clients.length],
  ).filter((client): client is FixtureClient => client !== undefined);
  const overlapByRuleCode = Object.fromEntries(
    [0, 1].flatMap((offset) => {
      const rule = ruleCatalogue[(digest.readUInt8(5) + offset * 7) % ruleCatalogue.length];
      const share = round(((digest.readUInt8(6 + offset) / 255) * FAKE_MAX_OVERLAP_SHARE) / (offset + 1));

      return rule ? [[rule.code, share]] : [];
    }),
  );
  const maxOverlap =
    Object.entries(overlapByRuleCode)
      .map(([ruleCode, share]) => ({ ruleCode, share }))
      .toSorted((first, second) => second.share - first.share)[0] ?? null;
  const clientShare = clientCount / clients.length;

  return {
    violation: null,
    hitCount: clientCount * (1 + (digest.readUInt8(8) % 4)),
    clientCount,
    clientShare: round(clientShare),
    overlapByRuleCode,
    maxOverlap,
    clientsByRiskScore: countBy(
      AML_RISK_SCORES,
      matchedClients.map(({ riskScore }) => riskScore),
    ),
    clientsByClientType: countBy(
      CLIENT_TYPES,
      matchedClients.map(({ clientType }) => clientType),
    ),
    sampleClientIds: matchedClients
      .slice(0, report.params.llm.maxSampleClientIds)
      .map(({ clientId }) => clientId),
    discardReason: findFakeDiscardReason(clientShare, maxOverlap, report),
  };
}

function findFakeDiscardReason(
  clientShare: number,
  maxOverlap: RuleBacktest["maxOverlap"],
  report: RuleReviewReport,
): string | null {
  if (clientShare > report.params.backtest.maxClientShare) {
    return `hits ${round(clientShare * 100)} % of clients, more than ${report.params.backtest.maxClientShare * 100} %`;
  }

  if (maxOverlap && maxOverlap.share >= report.params.backtest.maxOverlapWithExistingRule) {
    return `overlaps ${round(maxOverlap.share * 100)} % with ${maxOverlap.ruleCode}`;
  }

  return null;
}

function countBy<Key extends string>(keys: readonly Key[], values: Key[]): Record<Key, number> {
  return Object.fromEntries(
    keys.map((key) => [key, values.filter((value) => value === key).length]),
  ) as Record<Key, number>;
}

function countFullMonths(from: Date, to: Date): number {
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();

  return to.getUTCDate() < from.getUTCDate() ? months - 1 : months;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
