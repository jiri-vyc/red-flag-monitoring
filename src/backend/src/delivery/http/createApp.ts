import express, { type Express } from "express";

import type { DatabaseStatusQueries } from "../../application/databaseStatus/databaseStatusQueries";
import type { DraftingJobUseCases } from "../../application/drafting/draftingJobUseCases";
import type { EvaluationRunQueries } from "../../application/evaluationRuns/evaluationRunQueries";
import type { EvaluationRunUseCases } from "../../application/evaluationRuns/evaluationRunUseCases";
import type { InternalPolicyUseCases } from "../../application/internalPolicies/internalPolicyUseCases";
import type { ReferenceListUseCases } from "../../application/referenceLists/referenceListUseCases";
import type { RegulationUseCases } from "../../application/regulations/regulationUseCases";
import type { RuleUseCases } from "../../application/rules/ruleUseCases";
import type { TransactionQueries } from "../../application/transactions/transactionQueries";
import type { UserUseCases } from "../../application/users/userUseCases";
import type { WhitelistUseCases } from "../../application/whitelist/whitelistUseCases";
import type { EnsureDatabaseReady } from "../../infrastructure/database/memoizeInitialization";
import { createDatabaseStatusRouter } from "./databaseStatusRouter";
import { createDraftingJobsRouter } from "./draftingJobsRouter";
import { errorHandler, notFoundHandler } from "./errorHandler";
import { createEvaluationRunsRouter } from "./evaluationRunsRouter";
import { createHealthRouter } from "./healthRouter";
import { createInternalPoliciesRouter } from "./internalPoliciesRouter";
import { createReferenceListsRouter } from "./referenceListsRouter";
import { createRegulationsRouter } from "./regulationsRouter";
import { createRulesRouter } from "./rulesRouter";
import { createTransactionsRouter } from "./transactionsRouter";
import { createUsersRouter } from "./usersRouter";

// Regulation versions carry the full pasted text of a law (the largest in knowledgebase/ is ~400 kB).
const JSON_BODY_LIMIT = "5mb";

export type AppUseCases = {
  regulations: RegulationUseCases;
  draftingJobs: DraftingJobUseCases;
  internalPolicies: InternalPolicyUseCases;
  rules: RuleUseCases;
  whitelist: WhitelistUseCases;
  referenceLists: ReferenceListUseCases;
  evaluationRuns: EvaluationRunQueries;
  evaluationRunUseCases: EvaluationRunUseCases;
  databaseStatus: DatabaseStatusQueries;
  users: UserUseCases;
  transactions: TransactionQueries;
};

export function createApp(useCases: AppUseCases, ensureDatabaseReady: EnsureDatabaseReady): Express {
  const app = express();

  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use("/api/health", createHealthRouter());
  app.use(async (_request, _response, next) => {
    await ensureDatabaseReady();
    next();
  });
  app.use("/api/regulations", createRegulationsRouter(useCases.regulations, useCases.draftingJobs));
  app.use("/api/drafting-jobs", createDraftingJobsRouter(useCases.draftingJobs));
  app.use("/api/internal-policies", createInternalPoliciesRouter(useCases.internalPolicies));
  app.use("/api/rules", createRulesRouter(useCases.rules, useCases.whitelist));
  app.use("/api/reference-lists", createReferenceListsRouter(useCases.referenceLists));
  app.use(
    "/api/evaluation-runs",
    createEvaluationRunsRouter(useCases.evaluationRuns, useCases.evaluationRunUseCases),
  );
  app.use("/api/database-status", createDatabaseStatusRouter(useCases.databaseStatus));
  app.use("/api/users", createUsersRouter(useCases.users));
  app.use("/api/transactions", createTransactionsRouter(useCases.transactions));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
