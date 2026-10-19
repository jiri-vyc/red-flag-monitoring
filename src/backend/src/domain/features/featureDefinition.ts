import type { FeatureContext } from "./featureContext";

export const FEATURE_VALUE_TYPES = ["number", "string", "boolean"] as const;
export type FeatureValueType = (typeof FEATURE_VALUE_TYPES)[number];

export const FEATURE_UNITS = ["CZK", "count", "months", "ratio"] as const;
export type FeatureUnit = (typeof FEATURE_UNITS)[number];

export type FeatureScalar = number | string | boolean | null;

// `contextRefs` are IDs of history transactions the value was computed from (F7, V8).
export type FeatureResult = { value: FeatureScalar; contextRefs: string[] };

// One entry of the feature catalogue (M10). `label` and `description` are Czech: they feed the human-readable
// rule text and the Bedrock prompt for the wizard.
export type FeatureDefinition = {
  id: string;
  label: string;
  description: string;
  valueType: FeatureValueType;
  unit: FeatureUnit | null;
  isNullable: boolean;
  calculate: (context: FeatureContext) => FeatureResult;
};

export function toPlainResult(value: FeatureScalar): FeatureResult {
  return { value, contextRefs: [] };
}

export function toResultFromTransactions(
  value: FeatureScalar,
  transactions: readonly { transactionId: string }[],
): FeatureResult {
  return { value, contextRefs: transactions.map((transaction) => transaction.transactionId) };
}
