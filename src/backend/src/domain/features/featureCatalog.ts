import { CLIENT_FEATURES } from "./clientFeatures";
import type { FeatureDefinition, FeatureUnit, FeatureValueType } from "./featureDefinition";
import { HISTORY_FEATURES } from "./historyFeatures";
import { PATTERN_FEATURES } from "./patternFeatures";
import { TRANSACTION_FEATURES } from "./transactionFeatures";

// M10: the feature catalogue lives in code only. Rule definitions reference features by `id`.
export const FEATURE_CATALOG: readonly FeatureDefinition[] = [
  ...TRANSACTION_FEATURES,
  ...CLIENT_FEATURES,
  ...HISTORY_FEATURES,
  ...PATTERN_FEATURES,
];

const FEATURES_BY_ID = new Map(FEATURE_CATALOG.map((feature) => [feature.id, feature]));

// Serializable view of the catalogue for the wizard prompt (Bedrock) and the Czech rule text.
export type FeatureDescription = {
  id: string;
  label: string;
  description: string;
  valueType: FeatureValueType;
  unit: FeatureUnit | null;
  isNullable: boolean;
};

export function findFeatureDefinition(featureId: string): FeatureDefinition | null {
  return FEATURES_BY_ID.get(featureId) ?? null;
}

export function describeFeatureCatalog(): FeatureDescription[] {
  return FEATURE_CATALOG.map(({ calculate: _calculate, ...description }) => description);
}
