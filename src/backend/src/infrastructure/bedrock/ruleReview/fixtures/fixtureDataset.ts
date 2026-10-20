import { readFileSync } from "node:fs";

import {
  AML_RISK_SCORES,
  type AmlRiskScore,
  CLIENT_TYPES,
  type ClientType,
  type ContractChannel,
} from "../../../../domain/client";

// The synthetic datasets/ CSVs read just far enough for the fixture CLI; amounts are taken as CZK, as in spec §3.4.

export type FixtureClient = {
  clientId: string;
  clientType: ClientType;
  riskScore: AmlRiskScore;
  isPep: boolean;
  contractChannel: ContractChannel;
  contractDate: Date;
};

export type FixtureTransaction = {
  transactionId: string;
  clientId: string;
  occurredAt: Date;
  amountCzk: number;
  isIncoming: boolean;
  counterpartyAccount: string;
  payerCountry: string;
};

export type FixtureDataset = {
  clientsById: Map<string, FixtureClient>;
  transactionsByClientId: Map<string, FixtureTransaction[]>;
};

export function loadFixtureDataset(datasetsDirectory: string): FixtureDataset {
  const clients = readCsvRows(`${datasetsDirectory}/clients.csv`).map(parseClient);
  const transactionsByClientId = new Map<string, FixtureTransaction[]>();

  for (const transaction of readCsvRows(`${datasetsDirectory}/transactions.csv`).map(parseTransaction)) {
    const clientTransactions = transactionsByClientId.get(transaction.clientId) ?? [];
    clientTransactions.push(transaction);
    transactionsByClientId.set(transaction.clientId, clientTransactions);
  }

  return { clientsById: new Map(clients.map((client) => [client.clientId, client])), transactionsByClientId };
}

function readCsvRows(path: string): string[][] {
  const [, ...rows] = readFileSync(path, "utf8")
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);

  return rows.map((row) => row.split(";"));
}

function parseClient([
  clientId = "",
  ,
  contractDate = "",
  channel = "",
  pep = "",
  type = "",
  ...rest
]: string[]): FixtureClient {
  const riskScore = rest.at(-1) ?? "";

  return {
    clientId,
    clientType: findClientType(type),
    riskScore: AML_RISK_SCORES.find((score) => score === riskScore) ?? "low",
    isPep: pep === "Y",
    contractChannel: channel === "in person" ? "in_person" : "distant",
    contractDate: parseCzechDate(contractDate),
  };
}

function parseTransaction([
  transactionId = "",
  clientId = "",
  date = "",
  time = "",
  volume = "",
  ,
  payerCountry = "",
  ,
  payerAccount = "",
  payeeAccount = "",
  type = "",
]: string[]): FixtureTransaction {
  const isIncoming = type.startsWith("incoming");

  return {
    transactionId,
    clientId,
    occurredAt: new Date(`${parseCzechDate(date).toISOString().slice(0, 10)}T${time}Z`),
    amountCzk: Number(volume),
    isIncoming,
    counterpartyAccount: isIncoming ? payerAccount : payeeAccount,
    payerCountry,
  };
}

// The CSV spells entrepreneur "enterpreneur".
function findClientType(text: string): ClientType {
  const normalized = text.replace("enterpreneur", "entrepreneur").replace(" ", "_");

  return CLIENT_TYPES.find((clientType) => clientType === normalized) ?? "natural_person";
}

function parseCzechDate(text: string): Date {
  const [day, month, year] = text.split(".").map(Number);

  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}
