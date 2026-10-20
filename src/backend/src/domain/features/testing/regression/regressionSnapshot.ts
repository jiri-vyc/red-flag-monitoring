import type { RuleFeatures } from "../../../evaluation";
import type { Transaction } from "../../../transaction";
import { createTransactionEvaluator, type EvaluationDataset } from "../../../transactionEvaluator";
import { calculateFeatures } from "../../calculateFeatures";
import { FEATURE_CATALOG } from "../../featureCatalog";
import { createFeatureContext } from "../../featureContext";
import { createFxRateTable } from "../../fxRates";
import { createPayeeDayClientIndex } from "../../payeeDayClientIndex";
import { priceTransactionsChronologically } from "../../pricedTransaction";
import { loadDatasetFromCsv, loadSampleRuleSet } from "./datasetCsv";

const SAMPLE_EVERY_NTH_TRANSACTION = 1999;

export type RegressionSnapshot = {
  hitsByRule: Record<string, { transactions: number; clients: number }>;
  sampleFeatures: Record<string, RuleFeatures>;
};

export function computeRegressionSnapshot(): RegressionSnapshot {
  const dataset = loadDatasetFromCsv();

  return { hitsByRule: countHitsByRule(dataset), sampleFeatures: calculateSampleFeatures(dataset) };
}

function countHitsByRule(dataset: EvaluationDataset): RegressionSnapshot["hitsByRule"] {
  const ruleSet = loadSampleRuleSet();
  const evaluate = createTransactionEvaluator({ dataset, ruleSet });
  const ruleCodeByVersionId = new Map(
    ruleSet.ruleVersions.map((rule) => [rule.ruleVersionId, rule.ruleCode]),
  );
  const hits = new Map(
    ruleSet.ruleVersions.map((rule) => [rule.ruleCode, { transactions: 0, clients: new Set<string>() }]),
  );

  for (const transaction of dataset.transactions) {
    const evaluated = evaluate(transaction.transactionId);

    for (const ruleEvaluation of evaluated.ruleEvaluations) {
      const ruleHits = hits.get(ruleCodeByVersionId.get(ruleEvaluation.ruleVersionId) ?? "");

      if (ruleEvaluation.outcome === "hit" && ruleHits) {
        ruleHits.transactions += 1;
        ruleHits.clients.add(evaluated.clientId);
      }
    }
  }

  return Object.fromEntries(
    [...hits].map(([ruleCode, ruleHits]) => [
      ruleCode,
      { transactions: ruleHits.transactions, clients: ruleHits.clients.size },
    ]),
  );
}

function calculateSampleFeatures(dataset: EvaluationDataset): RegressionSnapshot["sampleFeatures"] {
  const fxRateTable = createFxRateTable(dataset.fxRates);
  const payeeDayClientIndex = createPayeeDayClientIndex(dataset.transactions);
  const clientsById = new Map(dataset.clients.map((client) => [client.clientId, client]));
  const sample = dataset.transactions.filter((_, index) => index % SAMPLE_EVERY_NTH_TRANSACTION === 0);
  const sampleClientIds = new Set(sample.map((transaction) => transaction.clientId));
  const historiesByClientId = new Map<string, Transaction[]>();

  for (const transaction of dataset.transactions) {
    if (sampleClientIds.has(transaction.clientId)) {
      historiesByClientId.set(transaction.clientId, [
        ...(historiesByClientId.get(transaction.clientId) ?? []),
        transaction,
      ]);
    }
  }

  const featureIds = FEATURE_CATALOG.map((feature) => feature.id);

  return Object.fromEntries(
    sample.map((transaction) => {
      const clientHistory = priceTransactionsChronologically(
        historiesByClientId.get(transaction.clientId) ?? [],
        fxRateTable,
      );
      const pricedTransaction = clientHistory.find(
        (candidate) => candidate.transactionId === transaction.transactionId,
      );
      const client = clientsById.get(transaction.clientId);

      if (!pricedTransaction || !client) {
        throw new Error(`Sample transaction ${transaction.transactionId} is not in the dataset`);
      }

      const context = createFeatureContext({
        transaction: pricedTransaction,
        client,
        clientHistory,
        payeeDayClientIndex,
      });

      return [transaction.transactionId, calculateFeatures({ featureIds, context }).features];
    }),
  );
}
