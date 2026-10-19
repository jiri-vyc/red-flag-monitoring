import { type FeatureDefinition, toPlainResult } from "./featureDefinition";
import { isOutgoingTransaction } from "./pricedTransaction";

// Features of the evaluated transaction itself (section 2.1 of spec/features.md).
export const TRANSACTION_FEATURES: FeatureDefinition[] = [
  {
    id: "tx_amount_czk",
    label: "částka transakce v CZK",
    description: "Částka vyhodnocované transakce přepočtená kurzem ČNB ke dni transakce.",
    valueType: "number",
    unit: "CZK",
    isNullable: false,
    calculate: (context) => toPlainResult(context.transaction.amountCzk),
  },
  {
    id: "tx_type",
    label: "typ transakce",
    description: "Typ vyhodnocované transakce: outgoing, incoming nebo remittance.",
    valueType: "string",
    unit: null,
    isNullable: false,
    calculate: (context) => toPlainResult(context.transaction.transactionType),
  },
  {
    id: "tx_is_outgoing",
    label: "transakce je odchozí",
    description: "Vyhodnocovaná transakce je odchozí platba nebo remitence.",
    valueType: "boolean",
    unit: null,
    isNullable: false,
    calculate: (context) => toPlainResult(isOutgoingTransaction(context.transaction)),
  },
  {
    id: "tx_payer_country",
    label: "země plátce",
    description: "Země plátce vyhodnocované transakce (ISO 3166-1 alpha-2). Prázdná, pokud chybí.",
    valueType: "string",
    unit: null,
    isNullable: true,
    calculate: (context) => toPlainResult(toPresentText(context.transaction.payerCountry)),
  },
  {
    id: "tx_payee_country",
    label: "země příjemce",
    description: "Země příjemce vyhodnocované transakce (ISO 3166-1 alpha-2).",
    valueType: "string",
    unit: null,
    isNullable: false,
    calculate: (context) => toPlainResult(context.transaction.payeeCountry),
  },
  {
    id: "tx_payer_info_missing",
    label: "chybí údaje o plátci",
    description: "U vyhodnocované transakce chybí účet plátce nebo země plátce.",
    valueType: "boolean",
    unit: null,
    isNullable: false,
    calculate: (context) =>
      toPlainResult(
        toPresentText(context.transaction.payerAccount) === null ||
          toPresentText(context.transaction.payerCountry) === null,
      ),
  },
];

function toPresentText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed === "" ? null : trimmed;
}
