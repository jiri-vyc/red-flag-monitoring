import { Router } from "express";
import { z } from "zod";

import { REGULATION_KINDS } from "../../domain/regulation";
import type { RegulationUseCases } from "../../application/regulations/regulationUseCases";
import { requiredText } from "./schemas";
import { parseRequest } from "./validation";

const regulationParamsSchema = z.object({ regulationId: z.uuid() });
const versionParamsSchema = regulationParamsSchema.extend({ versionId: z.uuid() });

const createRegulationSchema = z.object({
  code: requiredText,
  title: requiredText,
  kind: z.enum(REGULATION_KINDS),
  sourceUrl: z
    .url()
    .nullish()
    .transform((value) => value ?? null),
  checkedAt: z.iso
    .datetime({ offset: true })
    .nullish()
    .transform((value) => (value ? new Date(value) : null)),
});

const createVersionSchema = z.object({ label: requiredText, fullText: requiredText });

export function createRegulationsRouter(regulationUseCases: RegulationUseCases): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const regulation = parseRequest(createRegulationSchema, request.body);

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

  return router;
}
