import { Router } from "express";
import { z } from "zod";

import type { AmlEventQueries } from "../../application/amlEvents/amlEventQueries";
import { parseRequest } from "./validation";

const amlEventParamsSchema = z.object({ amlEventId: z.uuid() });

// A run's list of AML events is under /evaluation-runs/:runId/aml-events.
export function createAmlEventsRouter(amlEventQueries: AmlEventQueries): Router {
  const router = Router();

  router.get("/:amlEventId", async (request, response) => {
    const { amlEventId } = parseRequest(amlEventParamsSchema, request.params);

    response.json(await amlEventQueries.getAmlEventDetail(amlEventId));
  });

  return router;
}
