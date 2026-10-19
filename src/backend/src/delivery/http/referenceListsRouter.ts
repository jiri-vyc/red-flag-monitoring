import { Router } from "express";
import { z } from "zod";

import type { ReferenceListUseCases } from "../../application/referenceLists/referenceListUseCases";
import { optionalText, requiredText, uniqueBy } from "./schemas";
import { parseRequest } from "./validation";

const listParamsSchema = z.object({ listId: z.uuid() });
const versionParamsSchema = listParamsSchema.extend({ versionId: z.uuid() });

const createListSchema = z.object({ code: requiredText, title: requiredText });

const createVersionSchema = z.object({
  sourceNote: optionalText,
  items: z.array(requiredText).refine((items) => uniqueBy(items, (item) => item), {
    message: "Items must be unique",
  }),
});

export function createReferenceListsRouter(referenceListUseCases: ReferenceListUseCases): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const list = parseRequest(createListSchema, request.body);

    response.status(201).json(await referenceListUseCases.createList(list));
  });

  router.get("/", async (_request, response) => {
    response.json(await referenceListUseCases.listLists());
  });

  router.get("/:listId", async (request, response) => {
    const { listId } = parseRequest(listParamsSchema, request.params);

    response.json(await referenceListUseCases.getList(listId));
  });

  router.post("/:listId/versions", async (request, response) => {
    const { listId } = parseRequest(listParamsSchema, request.params);
    const version = parseRequest(createVersionSchema, request.body);

    response.status(201).json(await referenceListUseCases.createVersion({ ...version, listId }));
  });

  router.get("/:listId/versions", async (request, response) => {
    const { listId } = parseRequest(listParamsSchema, request.params);

    response.json(await referenceListUseCases.listVersions(listId));
  });

  router.get("/:listId/versions/:versionId", async (request, response) => {
    const { listId, versionId } = parseRequest(versionParamsSchema, request.params);

    response.json(await referenceListUseCases.getVersion(listId, versionId));
  });

  return router;
}
