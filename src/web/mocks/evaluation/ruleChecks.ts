import { z } from "zod";

import type { TraceStep, Transaction } from "@/features/batches/types";
import { assertUnreachable } from "@/lib/assertUnreachable";

import { calculateSeededFraction } from "../stableHash";
import type { MockClient } from "./mockClient";

/**
 * The mock cannot execute the displayed rule code, so each mock rule is bound to one of these hand-written checks.
 * Thresholds follow the FINREG ruleset (rules A–C) where possible.
 */
export const MOCK_CHECK_KINDS = [
  "high_risk_jurisdiction",
  "pep_outgoing",
  "large_amount",
  "client_max_exceeded",
  "high_risk_remittance",
  "night_activity",
  "threshold_structuring",
  "agentic_context",
] as const;
export const mockCheckKindSchema = z.enum(MOCK_CHECK_KINDS);
export type MockCheckKind = z.infer<typeof mockCheckKindSchema>;

export type CheckResult = { score: number; trace: TraceStep[] };
type CheckInput = { transaction: Transaction; client: MockClient; ruleId: string };

// Illustrative list for the demo only. Production must use the current EU and FATF high-risk lists.
export const DEMO_HIGH_RISK_COUNTRIES: readonly string[] = ["ZA", "MX", "BR", "IN", "TR"];

const HIGH_RISK_MIN_AMOUNT_CZK = 10_000;
const PEP_MIN_OUTGOING_AMOUNT_CZK = 100_000;
const LARGE_AMOUNT_CZK = 500_000;
const STRUCTURING_LOWER_CZK = 340_000;
const STRUCTURING_UPPER_CZK = 375_000;
const NIGHT_MIN_AMOUNT_CZK = 50_000;

const czk = (amount: number) => `${Math.round(amount).toLocaleString("cs-CZ")} CZK`;

function step(condition: string, isMet: boolean, detail: string): TraceStep {
  return { condition, isMet, detail };
}

function scoreWhenAllMet(trace: TraceStep[], scoreWhenMet: number): CheckResult {
  const isEveryConditionMet = trace.every((traceStep) => traceStep.isMet);
  return { score: isEveryConditionMet ? scoreWhenMet : 0, trace };
}

// A transaction with unclear direction counts as outgoing (FINREG rule B).
function isOutgoing(transaction: Transaction): boolean {
  return transaction.transactionType !== "incoming payment";
}

function checkHighRiskJurisdiction({ transaction, client }: CheckInput): CheckResult {
  const involvedCountries = [transaction.payerCountry, transaction.payeeCountry, client.country];
  const highRiskCountry = involvedCountries.find((country) => DEMO_HIGH_RISK_COUNTRIES.includes(country));
  return scoreWhenAllMet(
    [
      step(
        "Země plátce, příjemce nebo klienta je na seznamu vysoce rizikových zemí",
        highRiskCountry !== undefined,
        `Plátce ${transaction.payerCountry}, příjemce ${transaction.payeeCountry}, klient ${client.country}`,
      ),
      step(
        `Částka přesahuje ${czk(HIGH_RISK_MIN_AMOUNT_CZK)}`,
        transaction.amountCzk > HIGH_RISK_MIN_AMOUNT_CZK,
        czk(transaction.amountCzk),
      ),
    ],
    92,
  );
}

function checkPepOutgoing({ transaction, client }: CheckInput): CheckResult {
  return scoreWhenAllMet(
    [
      step("Klient je politicky exponovaná osoba", client.isPep, client.isPep ? "PEP: ano" : "PEP: ne"),
      step(
        "Transakce je odchozí nebo s nejasným směrem",
        isOutgoing(transaction),
        transaction.transactionType,
      ),
      step(
        `Částka přesahuje ${czk(PEP_MIN_OUTGOING_AMOUNT_CZK)}`,
        transaction.amountCzk > PEP_MIN_OUTGOING_AMOUNT_CZK,
        czk(transaction.amountCzk),
      ),
    ],
    96,
  );
}

function checkLargeAmount({ transaction }: CheckInput): CheckResult {
  const isLarge = transaction.amountCzk > LARGE_AMOUNT_CZK;
  const excessRatio = transaction.amountCzk / LARGE_AMOUNT_CZK;
  const score = isLarge ? Math.min(100, Math.round(60 + excessRatio * 10)) : 0;
  return {
    score,
    trace: [step(`Částka přesahuje ${czk(LARGE_AMOUNT_CZK)}`, isLarge, czk(transaction.amountCzk))],
  };
}

function checkClientMaxExceeded({ transaction, client }: CheckInput): CheckResult {
  const limit = client.maxTransactionQ2Czk * 2;
  return scoreWhenAllMet(
    [
      step(
        "Klient má historii transakcí za Q2 2026",
        client.maxTransactionQ2Czk > 0,
        czk(client.maxTransactionQ2Czk),
      ),
      step(
        "Transakce přesahuje dvojnásobek maximální transakce Q2 2026",
        transaction.amountCzk > limit,
        `${czk(transaction.amountCzk)} vs. limit ${czk(limit)}`,
      ),
    ],
    72,
  );
}

function checkHighRiskRemittance({ transaction, client }: CheckInput): CheckResult {
  return scoreWhenAllMet(
    [
      step(
        "Typ transakce je remitence",
        transaction.transactionType === "remittance",
        transaction.transactionType,
      ),
      step(
        "Klient má vysoký AML risk profil",
        client.riskProfile === "high",
        `Profil: ${client.riskProfile}`,
      ),
      step("Příjemce je v zahraničí", transaction.payeeCountry !== "CZ", transaction.payeeCountry),
    ],
    66,
  );
}

function checkNightActivity({ transaction }: CheckInput): CheckResult {
  const hour = Number(transaction.bookedAt.slice(11, 13));
  return scoreWhenAllMet(
    [
      step("Transakce proběhla mezi 00:00 a 05:00", hour < 5, transaction.bookedAt.slice(11, 19)),
      step(
        `Částka přesahuje ${czk(NIGHT_MIN_AMOUNT_CZK)}`,
        transaction.amountCzk > NIGHT_MIN_AMOUNT_CZK,
        czk(transaction.amountCzk),
      ),
    ],
    48,
  );
}

function checkThresholdStructuring({ transaction }: CheckInput): CheckResult {
  const isJustBelowThreshold =
    transaction.amountCzk >= STRUCTURING_LOWER_CZK && transaction.amountCzk < STRUCTURING_UPPER_CZK;
  return {
    score: isJustBelowThreshold ? 58 : 0,
    trace: [
      step(
        "Částka je těsně pod limitem 15 000 EUR",
        isJustBelowThreshold,
        `${czk(transaction.amountCzk)} (pásmo ${czk(STRUCTURING_LOWER_CZK)} až ${czk(STRUCTURING_UPPER_CZK)})`,
      ),
    ],
  };
}

/**
 * Stands in for an LLM agent: a seeded, mostly low score that rises with the client's risk factors, plus a trace
 * that names the context the agent would have looked at.
 */
function checkAgenticContext({ transaction, client, ruleId }: CheckInput): CheckResult {
  const baseScore = Math.pow(calculateSeededFraction(`${transaction.transactionId}:${ruleId}`), 4) * 50;
  const riskBoost = client.riskProfile === "high" ? 15 : 0;
  const pepBoost = client.isPep ? 18 : 0;
  const amountBoost = transaction.amountCzk > PEP_MIN_OUTGOING_AMOUNT_CZK ? 12 : 0;
  const foreignBoost = transaction.payeeCountry !== transaction.payerCountry ? 3 : 0;
  const score = Math.min(100, Math.round(baseScore + riskBoost + pepBoost + amountBoost + foreignBoost));
  return {
    score,
    trace: [
      step(
        "Agent načetl profil a historii klienta",
        true,
        `Profil ${client.riskProfile}, PEP ${client.isPep ? "ano" : "ne"}`,
      ),
      step("Vysoký AML risk profil klienta", riskBoost > 0, `Profil: ${client.riskProfile}`),
      step("Částka je nad obvyklou úrovní klienta", amountBoost > 0, czk(transaction.amountCzk)),
      step(
        "Přeshraniční tok prostředků",
        foreignBoost > 0,
        `${transaction.payerCountry} → ${transaction.payeeCountry}`,
      ),
      step("Agent vyhodnotil vzorec jako podezřelý", score >= 50, `Skóre agenta ${score}`),
    ],
  };
}

export function runMockCheck(checkKind: MockCheckKind, input: CheckInput): CheckResult {
  switch (checkKind) {
    case "high_risk_jurisdiction":
      return checkHighRiskJurisdiction(input);
    case "pep_outgoing":
      return checkPepOutgoing(input);
    case "large_amount":
      return checkLargeAmount(input);
    case "client_max_exceeded":
      return checkClientMaxExceeded(input);
    case "high_risk_remittance":
      return checkHighRiskRemittance(input);
    case "night_activity":
      return checkNightActivity(input);
    case "threshold_structuring":
      return checkThresholdStructuring(input);
    case "agentic_context":
      return checkAgenticContext(input);
    default:
      return assertUnreachable(checkKind);
  }
}
