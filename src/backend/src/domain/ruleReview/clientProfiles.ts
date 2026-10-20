import type { AmlRiskScore, ClientType, ContractChannel } from "../client";
import { calculateFullMonthsBetween } from "../features/calendar";
import { roundCzk } from "../features/pricedTransaction";
import type { ReviewDataset } from "./reviewDataset";
import type { FindingClient } from "./ruleReviewReport";

export const MAX_PROFILED_CLIENTS = 10;

// Aggregates over the finding's transactions, never the history itself (spec 5.3).
export type ClientProfile = {
  clientId: string;
  clientType: ClientType;
  riskScore: AmlRiskScore;
  isPep: boolean;
  contractChannel: ContractChannel;
  tenureMonths: number;
  nearMissCount: number;
  minDistance: number | null;
  findingTransactionCount: number;
  findingAmountCzk: { total: number; max: number };
};

export function profileFindingClients(
  clients: readonly FindingClient[],
  dataset: ReviewDataset,
  asOfDateKey: string,
): ClientProfile[] {
  return clients.slice(0, MAX_PROFILED_CLIENTS).flatMap((findingClient) => {
    const client = dataset.clientsById.get(findingClient.clientId);

    if (!client) {
      return [];
    }

    const transactionIds = new Set(findingClient.transactionIds);
    const amounts = (dataset.historiesByClientId.get(client.clientId) ?? [])
      .filter((transaction) => transactionIds.has(transaction.transactionId))
      .map((transaction) => transaction.amountCzk);

    return [
      {
        clientId: client.clientId,
        clientType: client.clientType,
        riskScore: client.amlRiskScore,
        isPep: client.isPep,
        contractChannel: client.contractChannel,
        tenureMonths: calculateFullMonthsBetween(client.contractDate, asOfDateKey),
        nearMissCount: findingClient.nearMissCount,
        minDistance: findingClient.minDistance,
        findingTransactionCount: amounts.length,
        findingAmountCzk: {
          total: roundCzk(amounts.reduce((sum, amount) => sum + amount, 0)),
          max: Math.max(0, ...amounts),
        },
      },
    ];
  });
}
