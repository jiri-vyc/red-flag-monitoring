import type { DataSource } from "typeorm";

import { systemClock } from "./application/clock";
import { DraftingJobExecutor } from "./application/drafting/draftingJobExecutor";
import type { DraftingJobLauncher } from "./application/drafting/draftingJobPorts";
import type { DraftGenerator } from "./application/drafting/draftGenerator";
import { DraftingJobUseCases } from "./application/drafting/draftingJobUseCases";
import type { RegulationUseCases } from "./application/regulations/regulationUseCases";
import type { AppConfig, DraftGeneratorConfig } from "./config";
import { BedrockDraftGenerator } from "./infrastructure/bedrock/BedrockDraftGenerator";
import { createBedrockClient } from "./infrastructure/bedrock/createBedrockClient";
import { TypeOrmDraftingJobRepository } from "./infrastructure/database/repositories/TypeOrmDraftingJobRepository";
import { TypeOrmInternalPolicyRepository } from "./infrastructure/database/repositories/TypeOrmInternalPolicyRepository";
import { TypeOrmReferenceListRepository } from "./infrastructure/database/repositories/TypeOrmReferenceListRepository";
import { TypeOrmRegulationRepository } from "./infrastructure/database/repositories/TypeOrmRegulationRepository";
import { TypeOrmRuleRepository } from "./infrastructure/database/repositories/TypeOrmRuleRepository";
import { DummyDraftGenerator } from "./infrastructure/drafting/DummyDraftGenerator";
import { HttpRegulationSourceFetcher } from "./infrastructure/drafting/HttpRegulationSourceFetcher";
import { InProcessDraftingJobLauncher } from "./infrastructure/drafting/InProcessDraftingJobLauncher";
import { LambdaDraftingJobLauncher } from "./infrastructure/drafting/LambdaDraftingJobLauncher";

export function createDraftingJobExecutor(
  dataSource: DataSource,
  draftGeneratorConfig: DraftGeneratorConfig,
): DraftingJobExecutor {
  return new DraftingJobExecutor({
    draftingJobRepository: new TypeOrmDraftingJobRepository(dataSource),
    draftGenerator: createDraftGenerator(dataSource, draftGeneratorConfig),
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

  return new InProcessDraftingJobLauncher(createDraftingJobExecutor(dataSource, appConfig.draftGenerator));
}

// DRAFT_GENERATOR=bedrock drafts with Claude on Amazon Bedrock; the dummy runs the flow without an LLM.
function createDraftGenerator(dataSource: DataSource, config: DraftGeneratorConfig): DraftGenerator {
  if (config.mode === "dummy") {
    return new DummyDraftGenerator();
  }

  return new BedrockDraftGenerator({
    createClient: () => createBedrockClient(config.bedrock),
    modelId: config.bedrock.modelId,
    regulationRepository: new TypeOrmRegulationRepository(dataSource),
    internalPolicyRepository: new TypeOrmInternalPolicyRepository(dataSource),
    ruleRepository: new TypeOrmRuleRepository(dataSource),
    referenceListRepository: new TypeOrmReferenceListRepository(dataSource),
  });
}
