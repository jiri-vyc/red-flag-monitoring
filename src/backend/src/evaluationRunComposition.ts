import type { DataSource } from "typeorm";

import { systemClock } from "./application/clock";
import { EvaluationRunExecutor } from "./application/evaluationRuns/evaluationRunExecutor";
import type { EvaluationRunLauncher } from "./application/evaluationRuns/evaluationRunPorts";
import { EvaluationRunUseCases } from "./application/evaluationRuns/evaluationRunUseCases";
import type { AppConfig } from "./config";
import { TypeOrmAmlEventRepository } from "./infrastructure/database/repositories/TypeOrmAmlEventRepository";
import { TypeOrmEvaluationInputRepository } from "./infrastructure/database/repositories/TypeOrmEvaluationInputRepository";
import { TypeOrmEvaluationRunRepository } from "./infrastructure/database/repositories/TypeOrmEvaluationRunRepository";
import { InProcessEvaluationRunLauncher } from "./infrastructure/evaluationRuns/InProcessEvaluationRunLauncher";
import { LambdaEvaluationRunLauncher } from "./infrastructure/evaluationRuns/LambdaEvaluationRunLauncher";

// Wiring shared by the API (main.ts) and the evaluation worker Lambda (evaluationWorker.ts).
export function createEvaluationRunExecutor(dataSource: DataSource): EvaluationRunExecutor {
  return new EvaluationRunExecutor({
    evaluationInputRepository: new TypeOrmEvaluationInputRepository(dataSource),
    evaluationRunRepository: new TypeOrmEvaluationRunRepository(dataSource),
    amlEventRepository: new TypeOrmAmlEventRepository(dataSource),
    clock: systemClock,
  });
}

export function createEvaluationRunUseCases(
  dataSource: DataSource,
  appConfig: AppConfig,
): EvaluationRunUseCases {
  return new EvaluationRunUseCases({
    evaluationInputRepository: new TypeOrmEvaluationInputRepository(dataSource),
    evaluationRunRepository: new TypeOrmEvaluationRunRepository(dataSource),
    evaluationRunLauncher: createEvaluationRunLauncher(dataSource, appConfig),
    clock: systemClock,
    engineVersion: appConfig.engineVersion,
  });
}

function createEvaluationRunLauncher(dataSource: DataSource, appConfig: AppConfig): EvaluationRunLauncher {
  if (appConfig.evaluationWorker.mode === "lambda") {
    return new LambdaEvaluationRunLauncher(appConfig.evaluationWorker);
  }

  return new InProcessEvaluationRunLauncher(createEvaluationRunExecutor(dataSource));
}
