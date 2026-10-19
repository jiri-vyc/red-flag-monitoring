import type { RuleFeatures } from "../evaluation";
import type { FeatureContext } from "./featureContext";
import { findFeatureDefinition } from "./featureCatalog";

// Stored next to the computed features so the trace shows the rate used (F3). Not usable in conditions.
export const FX_RATE_FEATURE_KEY = "tx_fx";

export type CalculatedFeatures = {
  features: RuleFeatures;
  // The evaluated transaction first, then every history transaction a feature was computed from (V8).
  contextRefs: string[];
};

export class UnknownFeatureError extends Error {
  constructor(featureId: string) {
    super(`Feature ${featureId} is not in the feature catalogue`);
  }
}

// Computes only the features a rule definition lists. Throws UnknownFeatureError or MissingFxRateError; the
// evaluation records that as the rule's `error` outcome.
export function calculateFeatures(input: {
  featureIds: readonly string[];
  context: FeatureContext;
}): CalculatedFeatures {
  const features: RuleFeatures = { [FX_RATE_FEATURE_KEY]: input.context.transaction.fxRate };
  const contextRefs = new Set([input.context.transaction.transactionId]);

  for (const featureId of input.featureIds) {
    const definition = findFeatureDefinition(featureId);

    if (!definition) {
      throw new UnknownFeatureError(featureId);
    }

    const result = definition.calculate(input.context);
    features[featureId] = result.value;
    result.contextRefs.forEach((transactionId) => contextRefs.add(transactionId));
  }

  return { features, contextRefs: [...contextRefs] };
}
