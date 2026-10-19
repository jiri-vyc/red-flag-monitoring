import { Router } from "express";
import { z } from "zod";

import { VERDICTS } from "../../domain/evaluation";
import type { EvaluationRunQueries } from "../../application/evaluationRuns/evaluationRunQueries";
import type { EvaluationRunUseCases } from "../../application/evaluationRuns/evaluationRunUseCases";
import { pageQuerySchema } from "./schemas";
import { parseRequest } from "./validation";

const runParamsSchema = z.object({ runId: z.uuid() });
const transactionParamsSchema = runParamsSchema.extend({ transactionId: z.string().regex(/^TX[0-9]{9}$/) });

const transactionListQuerySchema = pageQuerySchema.extend({
  verdict: z
    .enum(VERDICTS)
    .optional()
    .transform((value) => value ?? null),
  ruleVersionId: z
    .uuid()
    .optional()
    .transform((value) => value ?? null),
});

// Runs are immutable (V14): the API starts a run and reads its results, it never edits them.
export function createEvaluationRunsRouter(
  evaluationRunQueries: EvaluationRunQueries,
  evaluationRunUseCases: EvaluationRunUseCases,
): Router {
  const router = Router();

  router.post("/", async (_request, response) => {
    response.status(201).json(await evaluationRunUseCases.startRun());
  });

  router.get("/", async (request, response) => {
    const page = parseRequest(pageQuerySchema, request.query);

    response.json(await evaluationRunQueries.listRuns(page));
  });

  router.get("/:runId", async (request, response) => {
    const { runId } = parseRequest(runParamsSchema, request.params);

    response.json(await evaluationRunQueries.getRunSummary(runId));
  });

  router.get("/:runId/transactions", async (request, response) => {
    const { runId } = parseRequest(runParamsSchema, request.params);
    const { verdict, ruleVersionId, limit, offset } = parseRequest(transactionListQuerySchema, request.query);

    response.json(
      await evaluationRunQueries.listTransactionEvaluations(
        { runId, verdict, hitRuleVersionId: ruleVersionId },
        { limit, offset },
      ),
    );
  });

  router.get("/:runId/transactions/:transactionId", async (request, response) => {
    const { runId, transactionId } = parseRequest(transactionParamsSchema, request.params);

    response.json(await evaluationRunQueries.getTransactionEvaluationDetail(runId, transactionId));
  });

  return router;
}
