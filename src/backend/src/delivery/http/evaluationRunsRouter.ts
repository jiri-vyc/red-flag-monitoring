import { Router } from "express";
import { z } from "zod";

import { DEFAULT_HIT_THRESHOLD, VERDICTS } from "../../domain/evaluation";
import { ESCALATION_ROLES } from "../../domain/rule";
import { MAX_SCORE, MIN_SCORE } from "../../domain/score";
import { DEMO_ADMIN_USER_ID } from "../../domain/user";
import type { AlertTriageUseCases } from "../../application/alertTriage/alertTriageUseCases";
import type { AmlEventQueries } from "../../application/amlEvents/amlEventQueries";
import type { EvaluationRunQueries } from "../../application/evaluationRuns/evaluationRunQueries";
import type { EvaluationRunUseCases } from "../../application/evaluationRuns/evaluationRunUseCases";
import { CLIENT_ID_PATTERN, localTimestampSchema, pageQuerySchema, requiredText } from "./schemas";
import { parseRequest } from "./validation";

const runParamsSchema = z.object({ runId: z.uuid() });
const transactionParamsSchema = runParamsSchema.extend({ transactionId: z.string().regex(/^TX[0-9]{9}$/) });

const runScopeSchema = z
  .object({
    from: localTimestampSchema,
    to: localTimestampSchema,
    clientIds: z
      .array(z.string().regex(CLIENT_ID_PATTERN))
      .min(1)
      .nullish()
      .transform((value) => value ?? null),
    limit: z
      .number()
      .int()
      .positive()
      .nullish()
      .transform((value) => value ?? null),
  })
  .refine((scope) => !scope.from || !scope.to || scope.from < scope.to, {
    message: "scope.from must be before scope.to",
  });

// The web starts a run without a body, so every field is optional.
const startRunBodySchema = z.object({
  createdBy: z.uuid().default(DEMO_ADMIN_USER_ID),
  hitThreshold: z.number().int().min(MIN_SCORE).max(MAX_SCORE).default(DEFAULT_HIT_THRESHOLD),
  scope: runScopeSchema.default({ from: null, to: null, clientIds: null, limit: null }),
});

// Issue #6: the role the web is acting as; the backend trusts it (E5) and only filters hits by it (E3).
const escalationRoleQuerySchema = z
  .enum(ESCALATION_ROLES)
  .optional()
  .transform((value) => value ?? null);

const transactionDetailQuerySchema = z.object({ role: escalationRoleQuerySchema });

const transactionListQuerySchema = pageQuerySchema.extend({
  role: escalationRoleQuerySchema,
  verdict: z
    .enum(VERDICTS)
    .optional()
    .transform((value) => value ?? null),
  ruleVersionId: z
    .uuid()
    .optional()
    .transform((value) => value ?? null),
});

const amlEventListQuerySchema = pageQuerySchema.extend({
  alertType: requiredText.optional().transform((value) => value ?? null),
  clientId: z
    .string()
    .regex(CLIENT_ID_PATTERN)
    .optional()
    .transform((value) => value ?? null),
});

const MAX_SYNC_TRIAGE_CLIENTS = 20;

const triageBodySchema = z.object({
  source: z.enum(["rules", "llm"]).default("llm"),
  clientIds: z
    .array(z.string().regex(CLIENT_ID_PATTERN))
    .min(1)
    .nullish()
    .transform((value) => value ?? null),
  clientLimit: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((value) => value ?? null),
});

// Runs are immutable (V14): the API starts a run and reads its results, it never edits them.
export function createEvaluationRunsRouter(
  evaluationRunQueries: EvaluationRunQueries,
  evaluationRunUseCases: EvaluationRunUseCases,
  amlEventQueries: AmlEventQueries,
  alertTriageUseCases: AlertTriageUseCases,
): Router {
  const router = Router();

  // 202: the run is created as `running`; poll GET /:runId for tx_processed and the final status.
  router.post("/", async (request, response) => {
    const command = parseRequest(startRunBodySchema, request.body ?? {});

    response.status(202).json(await evaluationRunUseCases.startRun(command));
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
    const { verdict, ruleVersionId, role, limit, offset } = parseRequest(
      transactionListQuerySchema,
      request.query,
    );

    response.json(
      await evaluationRunQueries.listTransactionEvaluations(
        { runId, verdict, hitRuleVersionId: ruleVersionId, escalationRole: role },
        { limit, offset },
      ),
    );
  });

  router.get("/:runId/aml-events", async (request, response) => {
    const { runId } = parseRequest(runParamsSchema, request.params);
    const { alertType, clientId, limit, offset } = parseRequest(amlEventListQuerySchema, request.query);

    response.json(await amlEventQueries.listRunAmlEvents({ runId, alertType, clientId }, { limit, offset }));
  });

  // `rules` fills in the deterministic proposals of a run created before #14.
  router.post("/:runId/triage", async (request, response) => {
    const { runId } = parseRequest(runParamsSchema, request.params);
    const { source, clientIds, clientLimit } = parseRequest(triageBodySchema, request.body ?? {});

    if (source === "rules") {
      response.json({ triagedAlerts: await alertTriageUseCases.retriageRunWithRules(runId) });
      return;
    }

    const triageRequest = { runId, clientIds, clientLimit };

    if (clientIds && clientIds.length <= MAX_SYNC_TRIAGE_CLIENTS) {
      response.json(await alertTriageUseCases.triageClientsWithLlmNow(triageRequest));
      return;
    }

    await alertTriageUseCases.startLlmTriage(triageRequest);
    response.status(202).json({ status: "started" });
  });

  router.get("/:runId/aml-events.csv", async (request, response) => {
    const { runId } = parseRequest(runParamsSchema, request.params);

    response
      .type("text/csv")
      .attachment(`aml-events-${runId}.csv`)
      .send(await amlEventQueries.exportRunAmlEventsCsv(runId));
  });

  router.get("/:runId/transactions/:transactionId", async (request, response) => {
    const { runId, transactionId } = parseRequest(transactionParamsSchema, request.params);
    const { role } = parseRequest(transactionDetailQuerySchema, request.query);

    response.json(await evaluationRunQueries.getTransactionEvaluationDetail(runId, transactionId, role));
  });

  return router;
}
