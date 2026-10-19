import { Router } from "express";

import type { DatabaseStatusQueries } from "../../application/databaseStatus/databaseStatusQueries";

export function createDatabaseStatusRouter(databaseStatusQueries: DatabaseStatusQueries): Router {
  const router = Router();

  router.get("/", async (_request, response) => {
    response.json(await databaseStatusQueries.loadDatabaseStatus());
  });

  return router;
}
