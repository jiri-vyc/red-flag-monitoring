import type { FxRateSnapshot } from "../evaluation";
import type { Transaction } from "../transaction";
import { toDateKey, toIsoWeekKey, toMonthKey } from "./calendar";
import { BASE_CURRENCY, getFxRateOnDate, type FxRateTable } from "./fxRates";

// A transaction with its CZK amount and calendar keys, computed once per client history (F2, F3).
export type PricedTransaction = Transaction & {
  amountCzk: number;
  // The ČNB rate used for the conversion; null for CZK amounts.
  fxRate: FxRateSnapshot | null;
  occurredAtMs: number;
  dateKey: string;
  monthKey: string;
  isoWeekKey: string;
};

export function isOutgoingTransaction(transaction: Pick<Transaction, "transactionType">): boolean {
  return transaction.transactionType !== "incoming";
}

// The other side of the payment: the payer for incoming, the payee for outgoing and remittance.
export function getCounterpartyAccount(
  transaction: Pick<Transaction, "transactionType" | "payerAccount" | "payeeAccount">,
): string | null {
  return isOutgoingTransaction(transaction) ? transaction.payeeAccount : transaction.payerAccount;
}

export function roundCzk(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// Orders by time, then by transaction ID so transactions with the same timestamp keep a stable order (F1).
export function compareChronologically(left: PricedTransaction, right: PricedTransaction): number {
  if (left.occurredAtMs !== right.occurredAtMs) {
    return left.occurredAtMs - right.occurredAtMs;
  }

  return left.transactionId.localeCompare(right.transactionId);
}

export function priceTransactionsChronologically(
  transactions: readonly Transaction[],
  fxRates: FxRateTable,
): PricedTransaction[] {
  return transactions
    .map((transaction) => priceTransaction(transaction, fxRates))
    .sort(compareChronologically);
}

// V11: converts with the ČNB rate valid on the transaction date. Throws MissingFxRateError without a rate.
export function priceTransaction(transaction: Transaction, fxRates: FxRateTable): PricedTransaction {
  const dateKey = toDateKey(transaction.occurredAt);

  return {
    ...transaction,
    ...convertAmountToCzk({ transaction, dateKey, fxRates }),
    occurredAtMs: transaction.occurredAt.getTime(),
    dateKey,
    monthKey: toMonthKey(transaction.occurredAt),
    isoWeekKey: toIsoWeekKey(transaction.occurredAt),
  };
}

function convertAmountToCzk(input: {
  transaction: Transaction;
  dateKey: string;
  fxRates: FxRateTable;
}): Pick<PricedTransaction, "amountCzk" | "fxRate"> {
  const amount = Number(input.transaction.amount);

  if (input.transaction.currency === BASE_CURRENCY) {
    return { amountCzk: roundCzk(amount), fxRate: null };
  }

  const rate = getFxRateOnDate(input.fxRates, input.transaction.currency, input.dateKey);

  return {
    amountCzk: roundCzk(amount * rate.czkPerUnit),
    fxRate: { currency: rate.currency, rate_date: rate.rateDate, czk_per_unit: rate.czkPerUnit },
  };
}
