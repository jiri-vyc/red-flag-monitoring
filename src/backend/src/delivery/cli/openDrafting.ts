import "reflect-metadata";

import type { DraftingJobExecutor } from "../../application/drafting/draftingJobExecutor";
import type { NewDraftingJob } from "../../application/drafting/draftingJobPorts";
import { type DatabaseConfig, parseAppConfig, parseBedrockConfig } from "../../config";
import type { DraftingJob } from "../../domain/draftingJob";
import { createDraftingJobExecutor } from "../../draftingJobComposition";
import { describeBedrockAuth } from "../../infrastructure/bedrock/createBedrockClient";
import { createDataSource } from "../../infrastructure/database/createDataSource";
import { TypeOrmDraftingJobRepository } from "../../infrastructure/database/repositories/TypeOrmDraftingJobRepository";
import { TypeOrmInternalPolicyRepository } from "../../infrastructure/database/repositories/TypeOrmInternalPolicyRepository";
import { TypeOrmRegulationRepository } from "../../infrastructure/database/repositories/TypeOrmRegulationRepository";
import { TypeOrmRuleRepository } from "../../infrastructure/database/repositories/TypeOrmRuleRepository";

export type CliDrafting = {
  regulationRepository: TypeOrmRegulationRepository;
  internalPolicyRepository: TypeOrmInternalPolicyRepository;
  ruleRepository: TypeOrmRuleRepository;
  // Stores the job and runs it in this process, the way the drafting worker Lambda would.
  runJob: (job: NewDraftingJob) => Promise<DraftingJob>;
  close: () => Promise<void>;
};

// The demos always draft with Bedrock and write to the database in DATABASE_URL, like the API would.
export async function openDrafting(): Promise<CliDrafting> {
  const appConfig = parseAppConfig(process.env);
  const bedrockConfig = parseBedrockConfig(process.env);
  const dataSource = createDataSource(appConfig.database);

  console.log(
    `Model: ${bedrockConfig.modelId} (${bedrockConfig.region}), auth: ${describeBedrockAuth(bedrockConfig.auth)}`,
  );
  console.log(`Database: ${describeDatabase(appConfig.database)}\n`);
  await dataSource.initialize();

  const draftingJobRepository = new TypeOrmDraftingJobRepository(dataSource);
  const executor = createDraftingJobExecutor(dataSource, { mode: "bedrock", bedrock: bedrockConfig });

  return {
    regulationRepository: new TypeOrmRegulationRepository(dataSource),
    internalPolicyRepository: new TypeOrmInternalPolicyRepository(dataSource),
    ruleRepository: new TypeOrmRuleRepository(dataSource),
    runJob: (job) => runJob(job, draftingJobRepository, executor),
    close: () => dataSource.destroy(),
  };
}

async function runJob(
  newJob: NewDraftingJob,
  draftingJobRepository: TypeOrmDraftingJobRepository,
  executor: DraftingJobExecutor,
): Promise<DraftingJob> {
  const job = await draftingJobRepository.createJob(newJob);

  console.log(`Drafting job ${job.id} (${job.kind}) started…\n`);

  try {
    await executor.executeJob(job.id);
  } catch (error: unknown) {
    // The executor marks the job failed before it rethrows; the job row below carries the error.
    console.error(error);
  }

  const finishedJob = await draftingJobRepository.findJob(job.id);

  if (!finishedJob) {
    throw new Error(`Drafting job ${job.id} disappeared`);
  }

  console.log(`Job ${finishedJob.status}${finishedJob.errorMessage ? `: ${finishedJob.errorMessage}` : ""}`);
  finishedJob.warnings.forEach((warning) => console.warn(`⚠ ${warning}`));

  return finishedJob;
}

function describeDatabase(config: DatabaseConfig): string {
  if (config.authMode === "iam") {
    return `${config.database} on ${config.host}`;
  }

  const url = new URL(config.url);

  return `${url.pathname.slice(1)} on ${url.host}`;
}
