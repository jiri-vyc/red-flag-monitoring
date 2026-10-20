import type { Client } from "../client";
import { evaluateTransaction, type RunRuleSet, type RuleEvaluationResult } from "../evaluateTransaction";
import { createFeatureContext } from "../features/featureContext";
import type { FeatureParameters } from "../features/featureParameters";
import { createFxRateTable, MissingFxRateError } from "../features/fxRates";
import { createPayeeDayClientIndex, type PayeeDayClientIndex } from "../features/payeeDayClientIndex";
import { priceTransactionsChronologically, type PricedTransaction } from "../features/pricedTransaction";
import type { Transaction } from "../transaction";
import type { EvaluationDataset } from "../transactionEvaluator";
import { type CooperativeWork, TRANSACTIONS_PER_YIELD } from "./cooperativeWork";

export type ReviewDataset = {
  clientsById: ReadonlyMap<string, Client>;
  historiesByClientId: ReadonlyMap<string, readonly PricedTransaction[]>;
  payeeDayClientIndex: PayeeDayClientIndex;
  transactionCount: number;
  unpricedClientIds: readonly string[];
};

export type ReviewedTransaction = {
  transaction: PricedTransaction;
  client: Client;
  ruleEvaluations: RuleEvaluationResult[];
};

export function createReviewDataset(dataset: EvaluationDataset): ReviewDataset {
  const fxRateTable = createFxRateTable(dataset.fxRates);
  const historiesByClientId = new Map<string, readonly PricedTransaction[]>();
  const unpricedClientIds: string[] = [];

  for (const [clientId, transactions] of groupByClient(dataset.transactions)) {
    try {
      historiesByClientId.set(clientId, priceTransactionsChronologically(transactions, fxRateTable));
    } catch (error) {
      if (!(error instanceof MissingFxRateError)) {
        throw error;
      }

      unpricedClientIds.push(clientId);
    }
  }

  return {
    clientsById: new Map(dataset.clients.map((client) => [client.clientId, client])),
    historiesByClientId,
    payeeDayClientIndex: createPayeeDayClientIndex(dataset.transactions),
    transactionCount: dataset.transactions.length,
    unpricedClientIds,
  };
}

export function* evaluateReviewDataset(input: {
  dataset: ReviewDataset;
  ruleSet: RunRuleSet;
  featureParameters?: Readonly<FeatureParameters>;
  clientIds?: ReadonlySet<string>;
  visit: (reviewed: ReviewedTransaction) => void;
}): CooperativeWork<void> {
  let sinceYield = 0;

  for (const [clientId, history] of input.dataset.historiesByClientId) {
    const client = input.dataset.clientsById.get(clientId);

    if (!client || (input.clientIds && !input.clientIds.has(clientId))) {
      continue;
    }

    for (const transaction of history) {
      const context = createFeatureContext({
        transaction,
        client,
        clientHistory: history,
        payeeDayClientIndex: input.dataset.payeeDayClientIndex,
        parameters: input.featureParameters,
      });
      const { ruleEvaluations } = evaluateTransaction({ context, ruleSet: input.ruleSet });

      input.visit({ transaction, client, ruleEvaluations });
      sinceYield += 1;

      if (sinceYield >= TRANSACTIONS_PER_YIELD) {
        sinceYield = 0;
        yield;
      }
    }
  }
}

export function readVolumeAsCzk(dataset: EvaluationDataset): EvaluationDataset {
  return {
    ...dataset,
    transactions: dataset.transactions.map((transaction) => ({ ...transaction, currency: "CZK" })),
  };
}

function groupByClient(transactions: readonly Transaction[]): Map<string, Transaction[]> {
  const transactionsByClientId = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    const clientTransactions = transactionsByClientId.get(transaction.clientId) ?? [];
    clientTransactions.push(transaction);
    transactionsByClientId.set(transaction.clientId, clientTransactions);
  }

  return transactionsByClientId;
}
