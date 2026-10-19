import { Router } from "express";

import type { UserUseCases } from "../../application/users/userUseCases";

export function createUsersRouter(userUseCases: UserUseCases): Router {
  const router = Router();

  router.get("/", async (_request, response) => {
    response.json(await userUseCases.listUsers());
  });

  return router;
}
