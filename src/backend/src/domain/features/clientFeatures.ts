import { calculateFullMonthsBetween, toMonthStartDateKey } from "./calendar";
import { type FeatureDefinition, toPlainResult } from "./featureDefinition";
import { roundCzk } from "./pricedTransaction";
import { Q2_DAY_COUNT, Q2_MONTH_COUNT } from "./thresholds";

// Static client data and baselines derived from it (section 2.2 of spec/features.md). Q2 baselines are null
// for a client without transactions in Q2, so conditions on them evaluate to false (F6).
export const CLIENT_FEATURES: FeatureDefinition[] = [
  {
    id: "client_country",
    label: "země klienta",
    description: "Země klienta (ISO 3166-1 alpha-2).",
    valueType: "string",
    unit: null,
    isNullable: false,
    calculate: (context) => toPlainResult(context.client.country),
  },
  {
    id: "client_is_pep",
    label: "klient je PEP",
    description: "Klient je politicky exponovaná osoba.",
    valueType: "boolean",
    unit: null,
    isNullable: false,
    calculate: (context) => toPlainResult(context.client.isPep),
  },
  {
    id: "client_risk_score",
    label: "AML rizikový profil klienta",
    description: "AML rizikový profil klienta: low, medium nebo high.",
    valueType: "string",
    unit: null,
    isNullable: false,
    calculate: (context) => toPlainResult(context.client.amlRiskScore),
  },
  {
    id: "client_contract_channel",
    label: "způsob uzavření smlouvy",
    description: "Jak klient uzavřel smlouvu: in_person (osobně) nebo distant (na dálku).",
    valueType: "string",
    unit: null,
    isNullable: false,
    calculate: (context) => toPlainResult(context.client.contractChannel),
  },
  {
    id: "client_tenure_months_at_tx",
    label: "délka vztahu ke dni transakce (celé měsíce)",
    description: "Počet celých měsíců od uzavření smlouvy ke dni vyhodnocované transakce.",
    valueType: "number",
    unit: "months",
    isNullable: false,
    calculate: (context) =>
      toPlainResult(calculateFullMonthsBetween(context.client.contractDate, context.transaction.dateKey)),
  },
  {
    id: "client_tenure_months_at_month_start",
    label: "délka vztahu k začátku měsíce (celé měsíce)",
    description: "Počet celých měsíců od uzavření smlouvy k 1. dni měsíce vyhodnocované transakce.",
    valueType: "number",
    unit: "months",
    isNullable: false,
    calculate: (context) =>
      toPlainResult(
        calculateFullMonthsBetween(
          context.client.contractDate,
          toMonthStartDateKey(context.transaction.occurredAt),
        ),
      ),
  },
  {
    id: "client_projected_monthly_volume_czk",
    label: "očekávaný měsíční objem klienta",
    description: "Očekávaný měsíční objem transakcí klienta v CZK uvedený při uzavření smlouvy.",
    valueType: "number",
    unit: "CZK",
    isNullable: false,
    calculate: (context) => toPlainResult(Number(context.client.projectedMonthlyVolumeCzk)),
  },
  {
    id: "client_projected_monthly_tx_count",
    label: "očekávaný měsíční počet transakcí klienta",
    description: "Očekávaný měsíční počet transakcí klienta uvedený při uzavření smlouvy.",
    valueType: "number",
    unit: "count",
    isNullable: false,
    calculate: (context) => toPlainResult(context.client.projectedMonthlyTxCount),
  },
  {
    id: "client_q2_daily_avg_volume_czk",
    label: "průměrný denní objem klienta za 2Q2026",
    description:
      "Skutečný objem transakcí klienta za 2Q2026 v CZK vydělený 91 dny. Prázdné bez transakcí v Q2.",
    valueType: "number",
    unit: "CZK",
    isNullable: true,
    calculate: (context) =>
      toPlainResult(
        hasQ2Activity(context.client) ? roundCzk(Number(context.client.q2VolumeCzk) / Q2_DAY_COUNT) : null,
      ),
  },
  {
    id: "client_q2_monthly_avg_tx_count",
    label: "průměrný měsíční počet transakcí klienta za 2Q2026",
    description: "Skutečný počet transakcí klienta za 2Q2026 vydělený 3 měsíci. Prázdné bez transakcí v Q2.",
    valueType: "number",
    unit: "count",
    isNullable: true,
    calculate: (context) =>
      toPlainResult(hasQ2Activity(context.client) ? context.client.q2TxCount / Q2_MONTH_COUNT : null),
  },
  {
    id: "client_q2_max_tx_czk",
    label: "největší transakce klienta za 2Q2026",
    description: "Částka největší transakce klienta za 2Q2026 v CZK. Prázdné bez transakcí v Q2.",
    valueType: "number",
    unit: "CZK",
    isNullable: true,
    calculate: (context) =>
      toPlainResult(hasQ2Activity(context.client) ? Number(context.client.q2MaxTxCzk) : null),
  },
];

function hasQ2Activity(client: { q2TxCount: number }): boolean {
  return client.q2TxCount > 0;
}
