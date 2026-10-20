import type { BedrockConfig } from "../../../config";
import { createBedrockClient } from "../createBedrockClient";
import { BedrockFindingExplainer } from "./BedrockFindingExplainer";
import { BedrockHypothesisExplorer } from "./BedrockHypothesisExplorer";
import type { FindingExplainer, HypothesisExplorer } from "../../../application/ruleReviews/ruleReviewPorts";

export type RuleReviewLlm = { findingExplainer: FindingExplainer; hypothesisExplorer: HypothesisExplorer };

export function createBedrockRuleReviewLlm(config: BedrockConfig): RuleReviewLlm {
  const createClient = () => createBedrockClient(config);

  return {
    findingExplainer: new BedrockFindingExplainer({ createClient, modelId: config.modelId }),
    hypothesisExplorer: new BedrockHypothesisExplorer({
      createClient,
      modelId: config.modelId,
      now: Date.now,
    }),
  };
}
