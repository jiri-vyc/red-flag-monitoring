import type { Client } from "../../client";
import type { Transaction } from "../../transaction";
import { calculateFeatures, type CalculatedFeatures } from "../calculateFeatures";
import { createFeatureContext } from "../featureContext";
import { EMPTY_PAYEE_DAY_CLIENT_INDEX, type PayeeDayClientIndex } from "../payeeDayClientIndex";
import { createFxRateTable } from "../fxRates";
import { priceTransactionsChronologically } from "../pricedTransaction";

export const CLIENT_ID = "K000001";
export const CLIENT_ACCOUNT = CLIENT_ID;

export function buildClient(overrides: Partial<Client> = {}): Client {
  return {
    clientId: CLIENT_ID,
    country: "CZ",
    contractDate: "2020-01-13",
    contractChannel: "in_person",
    isPep: false,
    clientType: "legal_entity",
    projectedMonthlyVolumeCzk: "100000.00",
    projectedMonthlyTxCount: 10,
    q2VolumeCzk: "273000.00",
    q2TxCount: 30,
    q2MaxTxCzk: "30000.00",
    amlRiskScore: "low",
    ...overrides,
  };
}

// Times are local wall-clock values in July 2026, e.g. at("2026-07-01 10:00").
export function at(wallClock: string): Date {
  const [date = "", time = "00:00"] = wallClock.split(" ");
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const [hours = 0, minutes = 0] = time.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes);
}

export function buildOutgoing(input: { id: string; at: string; amount: number; payee: string }): Transaction {
  return buildTransaction({
    transactionId: input.id,
    occurredAt: at(input.at),
    amount: input.amount.toFixed(2),
    transactionType: "outgoing",
    payerAccount: CLIENT_ACCOUNT,
    payeeAccount: input.payee,
  });
}

export function buildIncoming(input: {
  id: string;
  at: string;
  amount: number;
  payer: string;
  payerCountry?: string;
}) {
  return buildTransaction({
    transactionId: input.id,
    occurredAt: at(input.at),
    amount: input.amount.toFixed(2),
    transactionType: "incoming",
    payerAccount: input.payer,
    payerCountry: input.payerCountry ?? "CZ",
    payeeAccount: CLIENT_ACCOUNT,
  });
}

export function buildTransaction(
  overrides: Partial<Transaction> & Pick<Transaction, "transactionId">,
): Transaction {
  return {
    clientId: CLIENT_ID,
    occurredAt: at("2026-07-01 10:00"),
    amount: "1000.00",
    currency: "CZK",
    payerCountry: "CZ",
    payeeCountry: "CZ",
    payerAccount: CLIENT_ACCOUNT,
    payeeAccount: "ACZ00001",
    transactionType: "outgoing",
    counterpartyAccount: null,
    counterpartyCountry: null,
    ...overrides,
  };
}

// Calculates features of `evaluatedId` with `history` as the client's whole history. Builders default to CZK,
// so no FX rates are needed.
export function calculateFeaturesOf(input: {
  featureIds: string[];
  history: Transaction[];
  evaluatedId: string;
  client?: Client;
  payeeDayClientIndex?: PayeeDayClientIndex;
}): CalculatedFeatures {
  const pricedHistory = priceTransactionsChronologically(input.history, createFxRateTable([]));
  const transaction = pricedHistory.find((candidate) => candidate.transactionId === input.evaluatedId);

  if (!transaction) {
    throw new Error(`Transaction ${input.evaluatedId} is not in the history`);
  }

  const context = createFeatureContext({
    transaction,
    client: input.client ?? buildClient(),
    clientHistory: pricedHistory,
    payeeDayClientIndex: input.payeeDayClientIndex ?? EMPTY_PAYEE_DAY_CLIENT_INDEX,
  });

  return calculateFeatures({ featureIds: input.featureIds, context });
}
