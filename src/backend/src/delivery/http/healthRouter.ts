import { Router } from "express";

export function createHealthRouter(): Router {
  const healthRouter = Router();

  healthRouter.get("/", (_request, response) => {
    response.json({ status: "ok" });
  });

  return healthRouter;
}
