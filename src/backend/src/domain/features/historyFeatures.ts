import { type FeatureContext, listTransactionsInTrailingHours } from "./featureContext";
import { type FeatureDefinition, type FeatureResult, toResultFromTransactions } from "./featureDefinition";
import { type PricedTransaction, roundCzk } from "./pricedTransaction";
import { LIMIT_L_CZK, NEAR_LIMIT_LOWER_CZK, SMALL_PAYMENT_WINDOW_DAYS } from "./thresholds";

const HOURS_PER_DAY = 24;

// Aggregates over the client history up to the evaluated transaction (section 2.3 of spec/features.md).
export const HISTORY_FEATURES: FeatureDefinition[] = [
  {
    id: "day_volume_czk",
    label: "denní objem klienta",
    description: "Součet všech transakcí klienta (všechny směry) v CZK ve dni transakce, až po ni.",
    valueType: "number",
    unit: "CZK",
    isNullable: false,
    calculate: (context) => sumAmounts(listSameDay(context)),
  },
  {
    id: "month_volume_czk",
    label: "měsíční objem klienta",
    description: "Součet všech transakcí klienta (všechny směry) v CZK v měsíci transakce, až po ni.",
    valueType: "number",
    unit: "CZK",
    isNullable: false,
    calculate: (context) => sumAmounts(listSameMonth(context)),
  },
  {
    id: "month_tx_count",
    label: "měsíční počet transakcí klienta",
    description: "Počet všech transakcí klienta v měsíci transakce, až po ni.",
    valueType: "number",
    unit: "count",
    isNullable: false,
    calculate: (context) => countTransactions(listSameMonth(context)),
  },
  {
    id: "month_remittance_sum_czk",
    label: "měsíční součet remitencí klienta",
    description: "Součet remitencí klienta v CZK v měsíci transakce, až po ni.",
    valueType: "number",
    unit: "CZK",
    isNullable: false,
    calculate: (context) =>
      sumAmounts(
        listSameMonth(context).filter((transaction) => transaction.transactionType === "remittance"),
      ),
  },
  {
    id: "day_distinct_payer_accounts",
    label: "počet různých účtů plátců za den",
    description: "Počet různých účtů plátců příchozích plateb klienta ve dni transakce, až po ni.",
    valueType: "number",
    unit: "count",
    isNullable: false,
    calculate: (context) =>
      countDistinct(listIncoming(listSameDay(context)), (transaction) => transaction.payerAccount),
  },
  {
    id: "day_distinct_payer_countries",
    label: "počet různých zemí plátců za den",
    description: "Počet různých zemí plátců příchozích plateb klienta ve dni transakce, až po ni.",
    valueType: "number",
    unit: "count",
    isNullable: false,
    calculate: (context) =>
      countDistinct(listIncoming(listSameDay(context)), (transaction) => transaction.payerCountry),
  },
  {
    id: "week_distinct_payer_countries",
    label: "počet různých zemí plátců za ISO týden",
    description: "Počet různých zemí plátců příchozích plateb klienta v ISO týdnu transakce, až po ni.",
    valueType: "number",
    unit: "count",
    isNullable: false,
    calculate: (context) =>
      countDistinct(listIncoming(listSameIsoWeek(context)), (transaction) => transaction.payerCountry),
  },
  {
    id: "near_limit_tx_count_7d",
    label: "počet transakcí těsně pod limitem za 7 dní",
    description:
      "Počet transakcí klienta (všechny směry) za posledních 7 dní s částkou 22 500–24 999,99 CZK.",
    valueType: "number",
    unit: "count",
    isNullable: false,
    calculate: (context) =>
      countTransactions(
        listTransactionsInTrailingHours(context, SMALL_PAYMENT_WINDOW_DAYS * HOURS_PER_DAY).filter(
          (transaction) =>
            transaction.amountCzk >= NEAR_LIMIT_LOWER_CZK && transaction.amountCzk < LIMIT_L_CZK,
        ),
      ),
  },
];

function listSameDay(context: FeatureContext): PricedTransaction[] {
  return context.historyUntilTransaction.filter(
    (transaction) => transaction.dateKey === context.transaction.dateKey,
  );
}

function listSameMonth(context: FeatureContext): PricedTransaction[] {
  return context.historyUntilTransaction.filter(
    (transaction) => transaction.monthKey === context.transaction.monthKey,
  );
}

function listSameIsoWeek(context: FeatureContext): PricedTransaction[] {
  return context.historyUntilTransaction.filter(
    (transaction) => transaction.isoWeekKey === context.transaction.isoWeekKey,
  );
}

function listIncoming(transactions: PricedTransaction[]): PricedTransaction[] {
  return transactions.filter((transaction) => transaction.transactionType === "incoming");
}

function sumAmounts(transactions: PricedTransaction[]): FeatureResult {
  const total = transactions.reduce((sum, transaction) => sum + transaction.amountCzk, 0);

  return toResultFromTransactions(roundCzk(total), transactions);
}

function countTransactions(transactions: PricedTransaction[]): FeatureResult {
  return toResultFromTransactions(transactions.length, transactions);
}

// Counts distinct non-empty values; transactions with an empty value are not cited.
function countDistinct(
  transactions: PricedTransaction[],
  toValue: (transaction: PricedTransaction) => string | null,
): FeatureResult {
  const withValue = transactions.filter((transaction) => (toValue(transaction) ?? "").trim() !== "");
  const distinctValues = new Set(withValue.map((transaction) => toValue(transaction)));

  return toResultFromTransactions(distinctValues.size, withValue);
}
