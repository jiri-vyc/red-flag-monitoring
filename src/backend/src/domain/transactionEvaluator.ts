import type { AmlRiskScore, Client } from "./client";
import {
  createFailedTransactionEvaluation,
  evaluateTransaction,
  type RunRuleSet,
  type TransactionEvaluationResult,
} from "./evaluateTransaction";
import { createFeatureContext } from "./features/featureContext";
import type { FeatureParameters } from "./features/featureParameters";
import { createFxRateTable, type FxRate, type FxRateTable, MissingFxRateError } from "./features/fxRates";
import { createPayeeDayClientIndex } from "./features/payeeDayClientIndex";
import { priceTransactionsChronologically, type PricedTransaction } from "./features/pricedTransaction";
import type { Transaction } from "./transaction";

// Every client, transaction and FX rate in the database at run time (V4, D18).
export type EvaluationDataset = {
  clients: readonly Client[];
  transactions: readonly Transaction[];
  fxRates: readonly FxRate[];
};

export type EvaluatedTransaction = TransactionEvaluationResult & {
  transactionId: string;
  clientId: string;
  clientRiskProfile: AmlRiskScore;
};

export type TransactionEvaluator = (transactionId: string) => EvaluatedTransaction;

export class TransactionNotInDatasetError extends Error {
  constructor(transactionId: string) {
    super(`Transaction ${transactionId} is not in the loaded dataset`);
  }
}

type PricedClientHistory =
  | { isPriced: true; transactionsById: ReadonlyMap<string, PricedTransaction>; history: PricedTransaction[] }
  | { isPriced: false; errorMessage: string };

// Builds the run-wide indexes once (README "Flow per evaluated transaction", steps 1–2) and returns a function
// that evaluates one transaction. A client's history is priced on first use and kept for the rest of the run.
export function createTransactionEvaluator(input: {
  dataset: EvaluationDataset;
  ruleSet: RunRuleSet;
  featureParameters?: Readonly<FeatureParameters>;
}): TransactionEvaluator {
  const fxRateTable = createFxRateTable(input.dataset.fxRates);
  const payeeDayClientIndex = createPayeeDayClientIndex(input.dataset.transactions);
  const clientsById = new Map(input.dataset.clients.map((client) => [client.clientId, client]));
  const transactionsByClientId = groupTransactionsByClient(input.dataset.transactions);
  const clientIdByTransactionId = new Map(
    input.dataset.transactions.map((transaction) => [transaction.transactionId, transaction.clientId]),
  );
  const pricedHistories = new Map<string, PricedClientHistory>();

  function getPricedHistory(clientId: string): PricedClientHistory {
    const cachedHistory = pricedHistories.get(clientId);

    if (cachedHistory) {
      return cachedHistory;
    }

    const pricedHistory = priceClientHistory(transactionsByClientId.get(clientId) ?? [], fxRateTable);
    pricedHistories.set(clientId, pricedHistory);

    return pricedHistory;
  }

  return (transactionId) => {
    const clientId = clientIdByTransactionId.get(transactionId);
    const client = clientId ? clientsById.get(clientId) : undefined;

    if (!clientId || !client) {
      throw new TransactionNotInDatasetError(transactionId);
    }

    const evaluatedTransaction = { transactionId, clientId, clientRiskProfile: client.amlRiskScore };
    const pricedHistory = getPricedHistory(clientId);

    if (!pricedHistory.isPriced) {
      return {
        ...evaluatedTransaction,
        ...createFailedTransactionEvaluation({
          ruleSet: input.ruleSet,
          errorMessage: pricedHistory.errorMessage,
        }),
      };
    }

    const transaction = pricedHistory.transactionsById.get(transactionId);

    if (!transaction) {
      throw new TransactionNotInDatasetError(transactionId);
    }

    const context = createFeatureContext({
      transaction,
      client,
      clientHistory: pricedHistory.history,
      payeeDayClientIndex,
      parameters: input.featureParameters,
    });

    return { ...evaluatedTransaction, ...evaluateTransaction({ context, ruleSet: input.ruleSet }) };
  };
}

function groupTransactionsByClient(transactions: readonly Transaction[]): Map<string, Transaction[]> {
  const transactionsByClientId = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    const clientTransactions = transactionsByClientId.get(transaction.clientId) ?? [];
    clientTransactions.push(transaction);
    transactionsByClientId.set(transaction.clientId, clientTransactions);
  }

  return transactionsByClientId;
}

// A history transaction without an FX rate breaks every feature of the client, so it fails the client.
function priceClientHistory(
  transactions: readonly Transaction[],
  fxRateTable: FxRateTable,
): PricedClientHistory {
  try {
    const history = priceTransactionsChronologically(transactions, fxRateTable);
    const transactionsById = new Map(history.map((transaction) => [transaction.transactionId, transaction]));

    return { isPriced: true, transactionsById, history };
  } catch (error) {
    if (error instanceof MissingFxRateError) {
      return { isPriced: false, errorMessage: error.message };
    }

    throw error;
  }
}
