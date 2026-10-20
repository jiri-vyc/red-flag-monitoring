import { MILLISECONDS_PER_HOUR } from "./calendar";
import {
  type FeatureContext,
  listTransactionsBefore,
  listTransactionsInTrailingHours,
} from "./featureContext";
import {
  type FeatureDefinition,
  type FeatureResult,
  toPlainResult,
  toResultFromTransactions,
} from "./featureDefinition";
import type { FeatureParameters } from "./featureParameters";
import { listPayeeDayPayments } from "./payeeDayClientIndex";
import {
  getCounterpartyAccount,
  isOutgoingTransaction,
  type PricedTransaction,
  roundCzk,
} from "./pricedTransaction";

const HOURS_PER_DAY = 24;
const RATIO_DECIMALS = 10_000;

type PassthroughFlow = {
  inflowCzk: number;
  outflowCzk: number;
  ratio: number;
  transactions: PricedTransaction[];
};

// Pattern features with parameters from context.parameters, by default thresholds.ts (section 2.4 of spec/features.md, F8). Each one
// looks only backwards from the evaluated transaction, so a pattern hits on the transaction that completes it.
export const PATTERN_FEATURES: FeatureDefinition[] = [
  {
    id: "payee_small_out_count_7d",
    label: "počet malých odchozích plateb stejnému příjemci za 7 dní",
    description:
      "Jen pro odchozí transakci. Počet odchozích transakcí klienta na účet příjemce této transakce za posledních 7 dní, každá pod 25 000 CZK.",
    valueType: "number",
    unit: "count",
    isNullable: true,
    calculate: (context) => {
      const smallPayments = findSmallPaymentsToSamePayee(context);

      return smallPayments
        ? toResultFromTransactions(smallPayments.length, smallPayments)
        : toPlainResult(null);
    },
  },
  {
    id: "payee_small_out_sum_7d_czk",
    label: "součet malých odchozích plateb stejnému příjemci za 7 dní",
    description: "Jen pro odchozí transakci. Součet v CZK stejných plateb jako payee_small_out_count_7d.",
    valueType: "number",
    unit: "CZK",
    isNullable: true,
    calculate: (context) => {
      const smallPayments = findSmallPaymentsToSamePayee(context);

      return smallPayments
        ? toResultFromTransactions(sumCzk(smallPayments), smallPayments)
        : toPlainResult(null);
    },
  },
  {
    id: "quick_forward_match_count",
    label: "počet příchozích plateb přeposlaných do 2 hodin",
    description:
      "Jen pro odchozí transakci. Počet příchozích transakcí za poslední 2 hodiny s částkou alespoň 25 000 CZK, které tato transakce přeposílá: částka je 0,9–1,1 × přijaté částky a příjemce není plátcem příchozí platby.",
    valueType: "number",
    unit: "count",
    isNullable: true,
    calculate: calculateQuickForwardMatchCount,
  },
  {
    id: "round_trip_match_count_72h",
    label: "počet kruhových plateb se stejnou protistranou za 72 hodin",
    description:
      "Jen pro transakci s částkou alespoň 25 000 CZK. Počet transakcí opačného směru se stejným účtem protistrany za posledních 72 hodin, také s částkou alespoň 25 000 CZK.",
    valueType: "number",
    unit: "count",
    isNullable: true,
    calculate: calculateRoundTripMatchCount,
  },
  {
    id: "passthrough_in_24h_czk",
    label: "přijatá částka průtokového vzoru",
    description:
      "Jen pro odchozí transakci. Součet příchozích plateb za 24 hodin do příchozí platby (kotvy) z posledních 6 hodin, pokud přesáhl 100 000 CZK. Použije se kotva s nejvyšším poměrem odeslané a přijaté částky.",
    valueType: "number",
    unit: "CZK",
    isNullable: true,
    calculate: (context) => toPassthroughResult(context, (flow) => flow.inflowCzk),
  },
  {
    id: "passthrough_out_6h_czk",
    label: "odeslaná částka průtokového vzoru",
    description:
      "Jen pro odchozí transakci. Součet odchozích plateb po kotvě až po tuto transakci na účty, které nejsou účtem žádného plátce přijaté částky.",
    valueType: "number",
    unit: "CZK",
    isNullable: true,
    calculate: (context) => toPassthroughResult(context, (flow) => flow.outflowCzk),
  },
  {
    id: "passthrough_ratio",
    label: "poměr odeslané a přijaté částky průtokového vzoru",
    description: "Jen pro odchozí transakci. Podíl passthrough_out_6h_czk / passthrough_in_24h_czk.",
    valueType: "number",
    unit: "ratio",
    isNullable: true,
    calculate: (context) => toPassthroughResult(context, (flow) => flow.ratio),
  },
  {
    id: "payee_day_distinct_clients",
    label: "počet různých klientů, kteří platí stejnému příjemci za den",
    description:
      "Jen pro odchozí transakci. Počet různých klientů instituce, kteří ve dni transakce až po ni poslali odchozí platbu na účet příjemce této transakce.",
    valueType: "number",
    unit: "count",
    isNullable: true,
    calculate: calculatePayeeDayDistinctClients,
  },
];

// R-07
function findSmallPaymentsToSamePayee(context: FeatureContext): PricedTransaction[] | null {
  if (!isOutgoingTransaction(context.transaction)) {
    return null;
  }

  const { smallPaymentWindowDays, smallPaymentMaxCzk } = context.parameters;

  return listTransactionsInTrailingHours(context, smallPaymentWindowDays * HOURS_PER_DAY).filter(
    (candidate) =>
      isOutgoingTransaction(candidate) &&
      candidate.payeeAccount === context.transaction.payeeAccount &&
      candidate.amountCzk < smallPaymentMaxCzk,
  );
}

// R-11
function calculateQuickForwardMatchCount(context: FeatureContext): FeatureResult {
  const forwardingPayment = context.transaction;

  if (!isOutgoingTransaction(forwardingPayment)) {
    return toPlainResult(null);
  }

  const { quickForwardWindowHours, quickForwardMinAmountCzk, quickForwardMinRatio, quickForwardMaxRatio } =
    context.parameters;
  const windowStartMs = forwardingPayment.occurredAtMs - quickForwardWindowHours * MILLISECONDS_PER_HOUR;
  const forwardedPayments = listTransactionsBefore(context).filter((candidate) => {
    if (candidate.transactionType !== "incoming" || candidate.occurredAtMs < windowStartMs) {
      return false;
    }

    if (
      candidate.amountCzk < quickForwardMinAmountCzk ||
      candidate.payerAccount === forwardingPayment.payeeAccount
    ) {
      return false;
    }

    const ratio = forwardingPayment.amountCzk / candidate.amountCzk;

    return ratio >= quickForwardMinRatio && ratio <= quickForwardMaxRatio;
  });

  return toResultFromTransactions(forwardedPayments.length, forwardedPayments);
}

// R-12: a pair of opposite payments with one counterparty hits on its second payment.
function calculateRoundTripMatchCount(context: FeatureContext): FeatureResult {
  const secondPayment = context.transaction;
  const counterpartyAccount = getCounterpartyAccount(secondPayment);
  const { roundTripWindowHours, roundTripMinAmountCzk } = context.parameters;

  if (secondPayment.amountCzk < roundTripMinAmountCzk || counterpartyAccount === null) {
    return toPlainResult(null);
  }

  const windowStartMs = secondPayment.occurredAtMs - roundTripWindowHours * MILLISECONDS_PER_HOUR;
  const firstPayments = listTransactionsBefore(context).filter(
    (candidate) =>
      candidate.occurredAtMs >= windowStartMs &&
      candidate.amountCzk >= roundTripMinAmountCzk &&
      isOutgoingTransaction(candidate) !== isOutgoingTransaction(secondPayment) &&
      getCounterpartyAccount(candidate) === counterpartyAccount,
  );

  return toResultFromTransactions(firstPayments.length, firstPayments);
}

// R-04
function toPassthroughResult(
  context: FeatureContext,
  toValue: (flow: PassthroughFlow) => number,
): FeatureResult {
  const strongestFlow = findStrongestPassthrough(context);

  return strongestFlow
    ? toResultFromTransactions(toValue(strongestFlow), strongestFlow.transactions)
    : toPlainResult(null);
}

// An anchor is an incoming payment at most 6 h before the evaluated outgoing one. Inflow sums incoming payments
// in the 24 h up to the anchor; outflow sums outgoing payments after the anchor up to now to accounts that are
// not among the inflow payers. Returns the anchor with the highest outflow / inflow ratio.
function findStrongestPassthrough(context: FeatureContext): PassthroughFlow | null {
  if (!isOutgoingTransaction(context.transaction)) {
    return null;
  }

  const history = context.historyUntilTransaction;
  const anchorWindowStartMs =
    context.transaction.occurredAtMs -
    context.parameters.passthroughOutflowWindowHours * MILLISECONDS_PER_HOUR;
  let strongestFlow: PassthroughFlow | null = null;

  for (const [anchorIndex, anchor] of history.entries()) {
    if (anchor.transactionType !== "incoming" || anchor.occurredAtMs < anchorWindowStartMs) {
      continue;
    }

    const flow = calculatePassthroughFlow({ history, anchorIndex, parameters: context.parameters });

    if (flow && (!strongestFlow || flow.ratio > strongestFlow.ratio)) {
      strongestFlow = flow;
    }
  }

  return strongestFlow;
}

function calculatePassthroughFlow(input: {
  history: readonly PricedTransaction[];
  anchorIndex: number;
  parameters: Readonly<FeatureParameters>;
}): PassthroughFlow | null {
  const anchor = input.history[input.anchorIndex];

  if (!anchor) {
    return null;
  }

  const inflowWindowStartMs =
    anchor.occurredAtMs - input.parameters.passthroughInflowWindowHours * MILLISECONDS_PER_HOUR;
  const inflow = input.history
    .slice(0, input.anchorIndex + 1)
    .filter(
      (candidate) => candidate.transactionType === "incoming" && candidate.occurredAtMs > inflowWindowStartMs,
    );
  const inflowCzk = sumCzk(inflow);

  if (inflowCzk <= input.parameters.passthroughMinInflowCzk) {
    return null;
  }

  const inflowPayerAccounts = new Set(inflow.map((payment) => payment.payerAccount));
  const outflow = input.history
    .slice(input.anchorIndex + 1)
    .filter(
      (candidate) => isOutgoingTransaction(candidate) && !inflowPayerAccounts.has(candidate.payeeAccount),
    );
  const outflowCzk = sumCzk(outflow);

  return {
    inflowCzk,
    outflowCzk,
    ratio: Math.round((outflowCzk / inflowCzk) * RATIO_DECIMALS) / RATIO_DECIMALS,
    transactions: [...inflow, ...outflow],
  };
}

// R-09: reads payments of other clients from the run-wide index, not from the client history.
function calculatePayeeDayDistinctClients(context: FeatureContext): FeatureResult {
  const payment = context.transaction;

  if (!isOutgoingTransaction(payment)) {
    return toPlainResult(null);
  }

  const paymentsUntilNow = listPayeeDayPayments(
    context.payeeDayClientIndex,
    payment.payeeAccount,
    payment.dateKey,
  ).filter(
    (candidate) =>
      candidate.occurredAtMs < payment.occurredAtMs ||
      (candidate.occurredAtMs === payment.occurredAtMs && candidate.transactionId <= payment.transactionId),
  );
  const distinctClients = new Set([
    payment.clientId,
    ...paymentsUntilNow.map((candidate) => candidate.clientId),
  ]);

  return toResultFromTransactions(distinctClients.size, paymentsUntilNow);
}

function sumCzk(transactions: readonly PricedTransaction[]): number {
  return roundCzk(transactions.reduce((sum, transaction) => sum + transaction.amountCzk, 0));
}
