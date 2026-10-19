import "reflect-metadata";

import type { DataSource } from "typeorm";

import { systemClock } from "./application/clock";
import { EvaluationRunQueries } from "./application/evaluationRuns/evaluationRunQueries";
import { InternalPolicyUseCases } from "./application/internalPolicies/internalPolicyUseCases";
import { ReferenceListUseCases } from "./application/referenceLists/referenceListUseCases";
import { RegulationUseCases } from "./application/regulations/regulationUseCases";
import { RuleUseCases } from "./application/rules/ruleUseCases";
import { WhitelistUseCases } from "./application/whitelist/whitelistUseCases";
import { parseAppConfig } from "./config";
import { type AppUseCases, createApp } from "./delivery/http/createApp";
import { createDataSource } from "./infrastructure/database/createDataSource";
import { memoizeInitialization } from "./infrastructure/database/memoizeInitialization";
import { TypeOrmEvaluationRunReadRepository } from "./infrastructure/database/repositories/TypeOrmEvaluationRunReadRepository";
import { TypeOrmInternalPolicyRepository } from "./infrastructure/database/repositories/TypeOrmInternalPolicyRepository";
import { TypeOrmReferenceListRepository } from "./infrastructure/database/repositories/TypeOrmReferenceListRepository";
import { TypeOrmRegulationRepository } from "./infrastructure/database/repositories/TypeOrmRegulationRepository";
import { TypeOrmRuleRepository } from "./infrastructure/database/repositories/TypeOrmRuleRepository";
import { TypeOrmWhitelistRepository } from "./infrastructure/database/repositories/TypeOrmWhitelistRepository";

// Lambda Web Functions kill the environment unless it listens within 10 s; an Aurora resume takes ~15 s.
function startServer(): void {
  const appConfig = parseAppConfig(process.env);
  const dataSource = createDataSource(appConfig.database);
  const ensureDatabaseReady = memoizeInitialization(dataSource);
  const app = createApp(createUseCases(dataSource), ensureDatabaseReady);

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

function createUseCases(dataSource: DataSource): AppUseCases {
  const ruleRepository = new TypeOrmRuleRepository(dataSource);

  return {
    regulations: new RegulationUseCases(new TypeOrmRegulationRepository(dataSource)),
    internalPolicies: new InternalPolicyUseCases(
      new TypeOrmInternalPolicyRepository(dataSource),
      systemClock,
    ),
    rules: new RuleUseCases(ruleRepository, systemClock),
    whitelist: new WhitelistUseCases(new TypeOrmWhitelistRepository(dataSource), ruleRepository),
    referenceLists: new ReferenceListUseCases(new TypeOrmReferenceListRepository(dataSource)),
    evaluationRuns: new EvaluationRunQueries(new TypeOrmEvaluationRunReadRepository(dataSource)),
  };
}

startServer();
