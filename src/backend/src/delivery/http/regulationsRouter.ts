import { Router } from "express";
import { z } from "zod";

import { DEMO_ADMIN_USER_ID } from "../../domain/user";
import type { DraftingJobUseCases } from "../../application/drafting/draftingJobUseCases";
import type { RegulationUseCases } from "../../application/regulations/regulationUseCases";
import { newRegulationSchema, requiredText } from "./schemas";
import { parseRequest } from "./validation";

const regulationParamsSchema = z.object({ regulationId: z.uuid() });
const versionParamsSchema = regulationParamsSchema.extend({ versionId: z.uuid() });

const createVersionSchema = z.object({ label: requiredText, fullText: requiredText });

const draftPoliciesSchema = z.object({ createdBy: z.uuid().default(DEMO_ADMIN_USER_ID) });

export function createRegulationsRouter(
  regulationUseCases: RegulationUseCases,
  draftingJobUseCases: DraftingJobUseCases,
): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const regulation = parseRequest(newRegulationSchema, request.body);

    response.status(201).json(await regulationUseCases.createRegulation(regulation));
  });

  router.get("/", async (_request, response) => {
    response.json(await regulationUseCases.listRegulations());
  });

  router.get("/:regulationId", async (request, response) => {
    const { regulationId } = parseRequest(regulationParamsSchema, request.params);

    response.json(await regulationUseCases.getRegulation(regulationId));
  });

  router.post("/:regulationId/versions", async (request, response) => {
    const { regulationId } = parseRequest(regulationParamsSchema, request.params);
    const version = parseRequest(createVersionSchema, request.body);

    response.status(201).json(await regulationUseCases.createVersion({ ...version, regulationId }));
  });

  router.get("/:regulationId/versions", async (request, response) => {
    const { regulationId } = parseRequest(regulationParamsSchema, request.params);

    response.json(await regulationUseCases.listVersions(regulationId));
  });

  router.get("/:regulationId/versions/:versionId", async (request, response) => {
    const { regulationId, versionId } = parseRequest(versionParamsSchema, request.params);

    response.json(await regulationUseCases.getVersion(regulationId, versionId));
  });

  // 202: drafting runs as a job, poll GET /api/drafting-jobs/:jobId for the drafted policy versions.
  router.post("/:regulationId/versions/:versionId/draft-policies", async (request, response) => {
    const { regulationId, versionId } = parseRequest(versionParamsSchema, request.params);
    const { createdBy } = parseRequest(draftPoliciesSchema, request.body ?? {});
    const job = await draftingJobUseCases.startPolicyJobForVersion({
      regulationId,
      regulationVersionId: versionId,
      createdBy,
    });

    response.status(202).location(`/api/drafting-jobs/${job.id}`).json(job);
  });

  return router;
}
