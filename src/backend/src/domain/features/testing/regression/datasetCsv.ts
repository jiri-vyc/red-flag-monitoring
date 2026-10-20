import { readFileSync } from "node:fs";
import path from "node:path";

import type { Client, ClientType, ContractChannel, AmlRiskScore } from "../../../client";
import type { RunRuleSet } from "../../../evaluateTransaction";
import type { RuleDefinition } from "../../../ruleDefinition";
import type { RiskProfile } from "../../../rule";
import type { Transaction, TransactionType } from "../../../transaction";
import type { EvaluationDataset } from "../../../transactionEvaluator";
import type { FxRate } from "../../fxRates";
import sampleRuleSet from "./sampleRuleSet.json";

const DATASETS_DIRECTORY = path.resolve(__dirname, "../../../../../../../datasets");

const CONTRACT_CHANNELS: Record<string, ContractChannel> = {
  "in person": "in_person",
  "distant form": "distant",
};
const CLIENT_TYPES: Record<string, ClientType> = {
  "natural person": "natural_person",
  enterpreneur: "entrepreneur",
  "legal entity": "legal_entity",
};
const TRANSACTION_TYPES: Record<string, TransactionType> = {
  "outgoing payment": "outgoing",
  "incoming payment": "incoming",
  remittance: "remittance",
};

// Empty CSV fields are NULL in the database, so they become null here.
export function loadDatasetFromCsv(): EvaluationDataset {
  return {
    clients: readRows("clients.csv").map(toClient),
    transactions: readRows("transactions.csv").map(toTransaction),
    fxRates: readRows("cnb-fx-rates.csv").map(([currency = "", rateDate = "", czkPerUnit = ""]) => ({
      currency,
      rateDate,
      czkPerUnit: Number(czkPerUnit),
    })) satisfies FxRate[],
  };
}

export function loadSampleRuleSet(): RunRuleSet {
  return {
    ruleVersions: sampleRuleSet.ruleVersions.map((ruleVersion) => ({
      ...ruleVersion,
      definition: ruleVersion.definition as RuleDefinition,
      riskProfiles: ruleVersion.riskProfiles as RiskProfile[],
    })),
    referenceLists: new Map(Object.entries(sampleRuleSet.referenceLists)),
    whitelistedClientIdsByRuleId: new Map(),
    hitThreshold: 50,
  };
}

function readRows(fileName: string): string[][] {
  const content = readFileSync(path.join(DATASETS_DIRECTORY, fileName), "utf8");

  return content
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(";"));
}

function toClient(fields: string[]): Client {
  const [
    clientId = "",
    country = "",
    contractDate = "",
    contractChannel = "",
    pep = "",
    clientType = "",
    projectedMonthlyVolumeCzk = "",
    projectedMonthlyTxCount = "",
    q2VolumeCzk = "",
    q2TxCount = "",
    q2MaxTxCzk = "",
    amlRiskScore = "",
  ] = fields;

  return {
    clientId,
    country,
    contractDate: toIsoDate(contractDate),
    contractChannel: CONTRACT_CHANNELS[contractChannel] as ContractChannel,
    isPep: pep === "Y",
    clientType: CLIENT_TYPES[clientType] as ClientType,
    projectedMonthlyVolumeCzk,
    projectedMonthlyTxCount: Number(projectedMonthlyTxCount),
    q2VolumeCzk,
    q2TxCount: Number(q2TxCount),
    q2MaxTxCzk,
    amlRiskScore: amlRiskScore as AmlRiskScore,
  };
}

function toTransaction(fields: string[]): Transaction {
  const [
    transactionId = "",
    clientId = "",
    date = "",
    time = "",
    amount = "",
    currency = "",
    payerCountry = "",
    payeeCountry = "",
    payerAccount = "",
    payeeAccount = "",
    transactionType = "",
  ] = fields;

  return {
    transactionId,
    clientId,
    occurredAt: toLocalDate(date, time),
    amount,
    currency,
    payerCountry: toNullable(payerCountry) as string,
    payeeCountry,
    payerAccount: toNullable(payerAccount),
    payeeAccount,
    transactionType: TRANSACTION_TYPES[transactionType] as TransactionType,
    counterpartyAccount: null,
    counterpartyCountry: null,
  };
}

function toIsoDate(czechDate: string): string {
  const [day, month, year] = czechDate.split(".");

  return `${year}-${month}-${day}`;
}

// pg parses `timestamp without time zone` into a local Date, see the calendar note in features/README.md.
function toLocalDate(czechDate: string, time: string): Date {
  const [day = 1, month = 1, year = 0] = czechDate.split(".").map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function toNullable(value: string): string | null {
  return value === "" ? null : value;
}
