// Entry point of the evaluation worker Lambda (classic Lambda, not a Web Function). The API invokes it
// asynchronously with the ID of a started run, see LambdaEvaluationRunLauncher.
import "reflect-metadata";

import { parseAppConfig } from "./config";
import { createEvaluationRunExecutor } from "./evaluationRunComposition";
import { createDataSource } from "./infrastructure/database/createDataSource";
import { memoizeInitialization } from "./infrastructure/database/memoizeInitialization";
import type { EvaluationWorkerEvent } from "./infrastructure/evaluationRuns/LambdaEvaluationRunLauncher";

const dataSource = createDataSource(parseAppConfig(process.env).database);
const ensureDatabaseReady = memoizeInitialization(dataSource);
const evaluationRunExecutor = createEvaluationRunExecutor(dataSource);

// Throws after the run is marked failed, so the invocation shows up as an error in Lambda metrics.
export async function handler(event: EvaluationWorkerEvent): Promise<void> {
  await ensureDatabaseReady();
  await evaluationRunExecutor.executeRun(event.runId);
}
