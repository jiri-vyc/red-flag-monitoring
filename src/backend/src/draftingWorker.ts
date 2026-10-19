// Classic Lambda, not a Web Function: invoked asynchronously by LambdaDraftingJobLauncher.
import "reflect-metadata";

import { parseAppConfig } from "./config";
import { createDraftingJobExecutor } from "./draftingJobComposition";
import { createDataSource } from "./infrastructure/database/createDataSource";
import { memoizeInitialization } from "./infrastructure/database/memoizeInitialization";
import type { DraftingWorkerEvent } from "./infrastructure/drafting/LambdaDraftingJobLauncher";

const appConfig = parseAppConfig(process.env);
const dataSource = createDataSource(appConfig.database);
const ensureDatabaseReady = memoizeInitialization(dataSource);
const draftingJobExecutor = createDraftingJobExecutor(dataSource, appConfig.draftGenerator);

// Throws after the job is marked failed, so the invocation shows up as an error in Lambda metrics.
export async function handler(event: DraftingWorkerEvent): Promise<void> {
  await ensureDatabaseReady();
  await draftingJobExecutor.executeJob(event.jobId);
}
