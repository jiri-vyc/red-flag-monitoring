import path from "node:path";

import type { DataSource } from "typeorm";

import { systemClock } from "./application/clock";
import { RuleReviewExecutor } from "./application/ruleReviews/ruleReviewExecutor";
import type { FindingExplainer, HypothesisExplorer } from "./application/ruleReviews/ruleReviewPorts";
import { RuleReviewUseCases } from "./application/ruleReviews/ruleReviewUseCases";
import { type AppConfig, InvalidConfigError, parseBedrockConfig } from "./config";
import { createBedrockRuleReviewLlm } from "./infrastructure/bedrock/ruleReview/createBedrockRuleReviewLlm";
import { FileSystemRuleReviewReportStore } from "./infrastructure/ruleReviews/FileSystemRuleReviewReportStore";
import { InProcessRuleReviewLauncher } from "./infrastructure/ruleReviews/InProcessRuleReviewLauncher";
import { NoopFindingExplainer, NoopHypothesisExplorer } from "./infrastructure/ruleReviews/NoopLlmPorts";
import { TypeOrmRuleReviewInputRepository } from "./infrastructure/ruleReviews/TypeOrmRuleReviewInputRepository";

const DEFAULT_RULE_REVIEW_DIR = path.resolve(__dirname, "../.rule-reviews");

export type RuleReviewConfig = { reportDirectory: string; llmMode: "off" | "bedrock" };

export function parseRuleReviewConfig(environment: NodeJS.ProcessEnv): RuleReviewConfig {
  const llmMode = environment.RULE_REVIEW_LLM || "off";

  if (llmMode !== "off" && llmMode !== "bedrock") {
    throw new InvalidConfigError(`RULE_REVIEW_LLM must be "off" or "bedrock", got "${llmMode}"`);
  }

  return { reportDirectory: environment.RULE_REVIEW_DIR || DEFAULT_RULE_REVIEW_DIR, llmMode };
}

export function createRuleReviewUseCases(
  dataSource: DataSource,
  appConfig: AppConfig,
  ruleReviewConfig: RuleReviewConfig,
  launch: "background" | "awaited" = "background",
): RuleReviewUseCases {
  const reportStore = new FileSystemRuleReviewReportStore(ruleReviewConfig.reportDirectory);
  const inputRepository = new TypeOrmRuleReviewInputRepository(dataSource);
  const executor = new RuleReviewExecutor({
    reportStore,
    inputRepository,
    ...createLlmPorts(ruleReviewConfig),
    clock: systemClock,
  });
  return new RuleReviewUseCases({
    reportStore,
    inputRepository,
    launcher:
      launch === "background"
        ? new InProcessRuleReviewLauncher(executor)
        : { launchReview: (reviewId) => executor.executeReview(reviewId) },
    clock: systemClock,
    engineVersion: appConfig.engineVersion,
    isLlmAvailable: ruleReviewConfig.llmMode === "bedrock",
  });
}

function createLlmPorts(config: RuleReviewConfig): {
  findingExplainer: FindingExplainer;
  hypothesisExplorer: HypothesisExplorer;
} {
  if (config.llmMode === "bedrock") {
    return createBedrockRuleReviewLlm(parseBedrockConfig(process.env));
  }

  return { findingExplainer: new NoopFindingExplainer(), hypothesisExplorer: new NoopHypothesisExplorer() };
}
