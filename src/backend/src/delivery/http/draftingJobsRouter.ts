import { type Response, Router } from "express";
import { z } from "zod";

import type {
  DraftingJobUseCases,
  RegulationTarget,
  StartPolicyJobCommand,
} from "../../application/drafting/draftingJobUseCases";
import { DRAFTING_JOB_KINDS, DRAFTING_JOB_STATUSES, type DraftingJob } from "../../domain/draftingJob";
import { DEMO_ADMIN_USER_ID } from "../../domain/user";
import { newRegulationSchema, optionalText, pageQuerySchema, requiredText } from "./schemas";
import { parseRequest } from "./validation";

const jobParamsSchema = z.object({ jobId: z.uuid() });

const sourceSchema = z.union([
  z.object({ kind: z.enum(["text", "markdown"]), content: requiredText }),
  z.object({ kind: z.literal("url"), url: z.url() }),
]);

const regulationTargetSchema = z
  .union([z.object({ id: z.uuid() }), newRegulationSchema])
  .nullish()
  .transform((target): RegulationTarget => {
    if (!target) {
      return null;
    }

    return "id" in target
      ? { kind: "existing", regulationId: target.id }
      : { kind: "new", regulation: target };
  });

const startPolicyJobSchema = z
  .object({
    source: sourceSchema,
    regulation: regulationTargetSchema,
    versionLabel: optionalText,
    scope: optionalText,
    createdBy: z.uuid().default(DEMO_ADMIN_USER_ID),
  })
  .refine((body) => body.source.kind === "url" || body.regulation !== null, {
    message: "regulation is required for a text or markdown source",
    path: ["regulation"],
  }) satisfies z.ZodType<StartPolicyJobCommand>;

const commaSeparated = <Value extends string>(values: readonly [Value, ...Value[]]) =>
  z
    .string()
    .transform((value) => value.split(",").map((item) => item.trim()))
    .pipe(z.array(z.enum(values)).min(1))
    .optional()
    .transform((value) => value ?? null);

const listJobsQuerySchema = pageQuerySchema.extend({
  status: commaSeparated(DRAFTING_JOB_STATUSES),
  kind: commaSeparated(DRAFTING_JOB_KINDS),
  regulationId: z
    .uuid()
    .optional()
    .transform((value) => value ?? null),
  policyVersionId: z
    .uuid()
    .optional()
    .transform((value) => value ?? null),
});

export function createDraftingJobsRouter(draftingJobUseCases: DraftingJobUseCases): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const command = parseRequest(startPolicyJobSchema, request.body);

    sendAccepted(response, await draftingJobUseCases.startPolicyJob(command));
  });

  router.get("/", async (request, response) => {
    const { status, kind, regulationId, policyVersionId, limit, offset } = parseRequest(
      listJobsQuerySchema,
      request.query,
    );

    response.json(
      await draftingJobUseCases.listJobs(
        { statuses: status, kinds: kind, regulationId, policyVersionId },
        { limit, offset },
      ),
    );
  });

  router.get("/:jobId", async (request, response) => {
    const { jobId } = parseRequest(jobParamsSchema, request.params);

    response.json(await draftingJobUseCases.getJob(jobId));
  });

  router.post("/:jobId/retry", async (request, response) => {
    const { jobId } = parseRequest(jobParamsSchema, request.params);

    sendAccepted(response, await draftingJobUseCases.retryJob(jobId));
  });

  return router;
}

function sendAccepted(response: Response, job: DraftingJob): void {
  response.status(202).location(`/api/drafting-jobs/${job.id}`).json(job);
}
