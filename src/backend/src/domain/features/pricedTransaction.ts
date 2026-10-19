import type { FxRateSnapshot } from "../evaluation";
import type { Transaction } from "../transaction";
import { toDateKey, toIsoWeekKey, toMonthKey } from "./calendar";
import { BASE_CURRENCY, getFxRateOnDate, type FxRateTable } from "./fxRates";

// A transaction with its CZK amount and calendar keys, computed once per client history (F2, F3).
export type PricedTransaction = Transaction & {
  amountCzk: number;
  // The ČNB rate used for the conversion; null when no conversion happened.
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

// Turns a transaction amount into CZK. The evaluation picks one for the whole run.
export type AmountPricer = (
  transaction: Transaction,
  dateKey: string,
) => { amountCzk: number; fxRate: FxRateSnapshot | null };

// V11: converts with the ČNB rate valid on the transaction date. Throws MissingFxRateError without a rate.
export function createFxRateAmountPricer(fxRates: FxRateTable): AmountPricer {
  return (transaction, dateKey) => {
    if (transaction.currency === BASE_CURRENCY) {
      return { amountCzk: roundCzk(Number(transaction.amount)), fxRate: null };
    }

    const rate = getFxRateOnDate(fxRates, transaction.currency, dateKey);

    return {
      amountCzk: roundCzk(Number(transaction.amount) * rate.czkPerUnit),
      fxRate: { currency: rate.currency, rate_date: rate.rateDate, czk_per_unit: rate.czkPerUnit },
    };
  };
}

// The PoC dataset holds amounts already in CZK whatever the currency column says: the median is the same in all
// 23 currencies (SVZ-03, Příloha 2). The sample rule counts are computed this way.
export const treatAmountAsCzk: AmountPricer = (transaction) => ({
  amountCzk: roundCzk(Number(transaction.amount)),
  fxRate: null,
});

export function priceTransactionsChronologically(
  transactions: readonly Transaction[],
  priceAmount: AmountPricer,
): PricedTransaction[] {
  return transactions
    .map((transaction) => priceTransaction(transaction, priceAmount))
    .sort(compareChronologically);
}

export function priceTransaction(transaction: Transaction, priceAmount: AmountPricer): PricedTransaction {
  const dateKey = toDateKey(transaction.occurredAt);

  return {
    ...transaction,
    ...priceAmount(transaction, dateKey),
    occurredAtMs: transaction.occurredAt.getTime(),
    dateKey,
    monthKey: toMonthKey(transaction.occurredAt),
    isoWeekKey: toIsoWeekKey(transaction.occurredAt),
  };
}
