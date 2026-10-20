import "reflect-metadata";

import type { DataSource } from "typeorm";

import { createAlertTriageUseCases } from "./alertTriageComposition";
import { AmlEventQueries } from "./application/amlEvents/amlEventQueries";
import { systemClock } from "./application/clock";
import { DatabaseStatusQueries } from "./application/databaseStatus/databaseStatusQueries";
import { EvaluationRunQueries } from "./application/evaluationRuns/evaluationRunQueries";
import { InternalPolicyUseCases } from "./application/internalPolicies/internalPolicyUseCases";
import { ReferenceListUseCases } from "./application/referenceLists/referenceListUseCases";
import { RegulationUseCases } from "./application/regulations/regulationUseCases";
import { RuleUseCases } from "./application/rules/ruleUseCases";
import { TransactionQueries } from "./application/transactions/transactionQueries";
import { UserUseCases } from "./application/users/userUseCases";
import { WhitelistUseCases } from "./application/whitelist/whitelistUseCases";
import { type AppConfig, parseAppConfig } from "./config";
import { type AppUseCases, createApp } from "./delivery/http/createApp";
import { createDraftingJobUseCases } from "./draftingJobComposition";
import { createEvaluationRunUseCases } from "./evaluationRunComposition";
import { createDataSource } from "./infrastructure/database/createDataSource";
import { memoizeInitialization } from "./infrastructure/database/memoizeInitialization";
import { TypeOrmDatabaseStatusProbe } from "./infrastructure/database/TypeOrmDatabaseStatusProbe";
import { TypeOrmAmlEventReadRepository } from "./infrastructure/database/repositories/TypeOrmAmlEventReadRepository";
import { TypeOrmEvaluationRunReadRepository } from "./infrastructure/database/repositories/TypeOrmEvaluationRunReadRepository";
import { TypeOrmInternalPolicyRepository } from "./infrastructure/database/repositories/TypeOrmInternalPolicyRepository";
import { TypeOrmReferenceListRepository } from "./infrastructure/database/repositories/TypeOrmReferenceListRepository";
import { TypeOrmRegulationRepository } from "./infrastructure/database/repositories/TypeOrmRegulationRepository";
import { TypeOrmRuleRepository } from "./infrastructure/database/repositories/TypeOrmRuleRepository";
import { TypeOrmTransactionRepository } from "./infrastructure/database/repositories/TypeOrmTransactionRepository";
import { TypeOrmUserRepository } from "./infrastructure/database/repositories/TypeOrmUserRepository";
import { TypeOrmWhitelistRepository } from "./infrastructure/database/repositories/TypeOrmWhitelistRepository";

// Lambda Web Functions kill the environment unless it listens within 10 s; an Aurora resume takes ~15 s.
function startServer(): void {
  const appConfig = parseAppConfig(process.env);
  const dataSource = createDataSource(appConfig.database);
  const ensureDatabaseReady = memoizeInitialization(dataSource);
  const app = createApp(createUseCases(dataSource, appConfig), ensureDatabaseReady);

  app.listen({ host: appConfig.host, port: appConfig.port }, (error?: Error) => {
    if (error) {
      console.error("Backend failed to start", error);
      process.exit(1);
    }

    console.log(`Backend listening on ${appConfig.host ?? "localhost"}:${appConfig.port}`);
    ensureDatabaseReady().catch((initializationError: unknown) => {
      console.error("Database initialization failed, retrying on the next request", initializationError);
    });
  });
}

function createUseCases(dataSource: DataSource, appConfig: AppConfig): AppUseCases {
  const ruleRepository = new TypeOrmRuleRepository(dataSource);
  const internalPolicyRepository = new TypeOrmInternalPolicyRepository(dataSource);
  const regulations = new RegulationUseCases(new TypeOrmRegulationRepository(dataSource));
  const rules = new RuleUseCases(ruleRepository, systemClock);
  const draftingJobs = createDraftingJobUseCases(dataSource, appConfig, regulations);
  const evaluationRunReadRepository = new TypeOrmEvaluationRunReadRepository(dataSource);

  return {
    regulations,
    draftingJobs,
    internalPolicies: new InternalPolicyUseCases(internalPolicyRepository, systemClock, draftingJobs),
    rules,
    whitelist: new WhitelistUseCases(new TypeOrmWhitelistRepository(dataSource), ruleRepository),
    referenceLists: new ReferenceListUseCases(new TypeOrmReferenceListRepository(dataSource)),
    evaluationRuns: new EvaluationRunQueries(evaluationRunReadRepository),
    evaluationRunUseCases: createEvaluationRunUseCases(dataSource, appConfig),
    amlEvents: new AmlEventQueries({
      amlEventReadRepository: new TypeOrmAmlEventReadRepository(dataSource),
      evaluationRunReadRepository,
    }),
    alertTriage: createAlertTriageUseCases(dataSource, appConfig.alertTriage),
    databaseStatus: new DatabaseStatusQueries(new TypeOrmDatabaseStatusProbe(dataSource)),
    users: new UserUseCases(new TypeOrmUserRepository(dataSource)),
    transactions: new TransactionQueries(new TypeOrmTransactionRepository(dataSource)),
  };
}

startServer();
