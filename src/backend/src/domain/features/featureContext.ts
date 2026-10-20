import type { Client } from "../client";
import { MILLISECONDS_PER_HOUR } from "./calendar";
import { DEFAULT_FEATURE_PARAMETERS, type FeatureParameters } from "./featureParameters";
import type { PayeeDayClientIndex } from "./payeeDayClientIndex";
import { compareChronologically, type PricedTransaction } from "./pricedTransaction";

export type FeatureContext = {
  transaction: PricedTransaction;
  client: Client;
  // Client transactions up to and including `transaction`, oldest first. Later ones are cut off (F1).
  historyUntilTransaction: readonly PricedTransaction[];
  payeeDayClientIndex: PayeeDayClientIndex;
  parameters: Readonly<FeatureParameters>;
};

export type FeatureContextInput = {
  transaction: PricedTransaction;
  client: Client;
  // The client's whole history (V4), oldest first. It may or may not contain `transaction`.
  clientHistory: readonly PricedTransaction[];
  payeeDayClientIndex: PayeeDayClientIndex;
  parameters?: Readonly<FeatureParameters>;
};

export function createFeatureContext(input: FeatureContextInput): FeatureContext {
  const earlierTransactions = input.clientHistory.filter(
    (candidate) =>
      candidate.transactionId !== input.transaction.transactionId &&
      compareChronologically(candidate, input.transaction) < 0,
  );

  return {
    transaction: input.transaction,
    client: input.client,
    historyUntilTransaction: [...earlierTransactions, input.transaction],
    payeeDayClientIndex: input.payeeDayClientIndex,
    parameters: input.parameters ?? DEFAULT_FEATURE_PARAMETERS,
  };
}

export function listTransactionsBefore(context: FeatureContext): readonly PricedTransaction[] {
  return context.historyUntilTransaction.slice(0, -1);
}

// Transactions in the window (t − hours, t], including the evaluated one.
export function listTransactionsInTrailingHours(context: FeatureContext, hours: number): PricedTransaction[] {
  const windowStartMs = context.transaction.occurredAtMs - hours * MILLISECONDS_PER_HOUR;

  return context.historyUntilTransaction.filter((candidate) => candidate.occurredAtMs > windowStartMs);
}
