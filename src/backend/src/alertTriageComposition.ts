import type { DataSource } from "typeorm";

import { AlertTriageUseCases } from "./application/alertTriage/alertTriageUseCases";
import { systemClock } from "./application/clock";
import type { AlertTriageConfig } from "./config";
import { InProcessAlertTriageLauncher } from "./infrastructure/alertTriage/InProcessAlertTriageLauncher";
import { BedrockAlertTriageModel } from "./infrastructure/bedrock/BedrockAlertTriageModel";
import { createBedrockClient } from "./infrastructure/bedrock/createBedrockClient";
import { TypeOrmAlertTriageRepository } from "./infrastructure/database/repositories/TypeOrmAlertTriageRepository";
import { TypeOrmEvaluationRunReadRepository } from "./infrastructure/database/repositories/TypeOrmEvaluationRunReadRepository";

export function createAlertTriageUseCases(
  dataSource: DataSource,
  config: AlertTriageConfig,
): AlertTriageUseCases {
  const alertTriageModel =
    config.mode === "bedrock"
      ? new BedrockAlertTriageModel({
          createClient: () => createBedrockClient(config.bedrock),
          modelId: config.bedrock.modelId,
        })
      : null;
  const useCases: AlertTriageUseCases = new AlertTriageUseCases({
    alertTriageRepository: new TypeOrmAlertTriageRepository(dataSource),
    evaluationRunReadRepository: new TypeOrmEvaluationRunReadRepository(dataSource),
    alertTriageModel,
    alertTriageLauncher: alertTriageModel
      ? new InProcessAlertTriageLauncher((request) => useCases.triageRunWithLlm(request))
      : null,
    clock: systemClock,
    llmConcurrency: config.mode === "bedrock" ? config.concurrency : 1,
  });

  return useCases;
}
