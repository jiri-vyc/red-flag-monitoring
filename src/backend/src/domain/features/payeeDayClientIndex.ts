import type { Transaction } from "../transaction";
import { toDateKey } from "./calendar";
import { isOutgoingTransaction } from "./pricedTransaction";

// R-09 needs payments of all clients to one payee account in a day. The evaluation builds this index once
// per run from every outgoing transaction in the database, so rules still never query it (D18).
export type PayeePaymentSource = Pick<
  Transaction,
  "transactionId" | "clientId" | "occurredAt" | "payeeAccount" | "transactionType"
>;

export type PayeeDayPayment = { transactionId: string; clientId: string; occurredAtMs: number };

export type PayeeDayClientIndex = ReadonlyMap<string, readonly PayeeDayPayment[]>;

export const EMPTY_PAYEE_DAY_CLIENT_INDEX: PayeeDayClientIndex = new Map();

export function createPayeeDayClientIndex(transactions: Iterable<PayeePaymentSource>): PayeeDayClientIndex {
  const paymentsByPayeeDay = new Map<string, PayeeDayPayment[]>();

  for (const transaction of transactions) {
    if (!isOutgoingTransaction(transaction)) {
      continue;
    }

    const key = toPayeeDayKey(transaction.payeeAccount, toDateKey(transaction.occurredAt));
    const payments = paymentsByPayeeDay.get(key) ?? [];
    payments.push({
      transactionId: transaction.transactionId,
      clientId: transaction.clientId,
      occurredAtMs: transaction.occurredAt.getTime(),
    });
    paymentsByPayeeDay.set(key, payments);
  }

  return paymentsByPayeeDay;
}

export function listPayeeDayPayments(
  index: PayeeDayClientIndex,
  payeeAccount: string,
  dateKey: string,
): readonly PayeeDayPayment[] {
  return index.get(toPayeeDayKey(payeeAccount, dateKey)) ?? [];
}

function toPayeeDayKey(payeeAccount: string, dateKey: string): string {
  return `${payeeAccount}|${dateKey}`;
}
