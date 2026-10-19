import type { DataSource } from "typeorm";

import { systemClock } from "./application/clock";
import { DraftingJobExecutor } from "./application/drafting/draftingJobExecutor";
import type { DraftingJobLauncher } from "./application/drafting/draftingJobPorts";
import { DraftingJobUseCases } from "./application/drafting/draftingJobUseCases";
import type { RegulationUseCases } from "./application/regulations/regulationUseCases";
import type { AppConfig } from "./config";
import { TypeOrmDraftingJobRepository } from "./infrastructure/database/repositories/TypeOrmDraftingJobRepository";
import { TypeOrmInternalPolicyRepository } from "./infrastructure/database/repositories/TypeOrmInternalPolicyRepository";
import { TypeOrmRegulationRepository } from "./infrastructure/database/repositories/TypeOrmRegulationRepository";
import { DummyDraftGenerator } from "./infrastructure/drafting/DummyDraftGenerator";
import { HttpRegulationSourceFetcher } from "./infrastructure/drafting/HttpRegulationSourceFetcher";
import { InProcessDraftingJobLauncher } from "./infrastructure/drafting/InProcessDraftingJobLauncher";
import { LambdaDraftingJobLauncher } from "./infrastructure/drafting/LambdaDraftingJobLauncher";

export function createDraftingJobExecutor(dataSource: DataSource): DraftingJobExecutor {
  return new DraftingJobExecutor({
    draftingJobRepository: new TypeOrmDraftingJobRepository(dataSource),
    // TODO(#1, #2): swap the dummy for a Bedrock-backed DraftGenerator.
    draftGenerator: new DummyDraftGenerator(),
    regulationRepository: new TypeOrmRegulationRepository(dataSource),
    internalPolicyRepository: new TypeOrmInternalPolicyRepository(dataSource),
    regulationSourceFetcher: new HttpRegulationSourceFetcher(),
    clock: systemClock,
  });
}

export function createDraftingJobUseCases(
  dataSource: DataSource,
  appConfig: AppConfig,
  regulationUseCases: RegulationUseCases,
): DraftingJobUseCases {
  return new DraftingJobUseCases({
    draftingJobRepository: new TypeOrmDraftingJobRepository(dataSource),
    draftingJobLauncher: createDraftingJobLauncher(dataSource, appConfig),
    regulationUseCases,
    clock: systemClock,
  });
}

function createDraftingJobLauncher(dataSource: DataSource, appConfig: AppConfig): DraftingJobLauncher {
  if (appConfig.draftingWorker.mode === "lambda") {
    return new LambdaDraftingJobLauncher(appConfig.draftingWorker);
  }

  return new InProcessDraftingJobLauncher(createDraftingJobExecutor(dataSource));
}
