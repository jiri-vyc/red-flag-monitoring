import { Router } from "express";
import { z } from "zod";

import { DEMO_ADMIN_USER_ID } from "../../domain/user";
import type { RuleReviewUseCases } from "../../application/ruleReviews/ruleReviewUseCases";
import { parseRequest } from "./validation";

const reviewParamsSchema = z.object({ reviewId: z.uuid() });

const startReviewBodySchema = z.object({
  createdBy: z.uuid().default(DEMO_ADMIN_USER_ID),
  evaluationRunId: z
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
  llm: z
    .boolean()
    .nullish()
    .transform((value) => value ?? null),
});

export function createRuleReviewsRouter(ruleReviewUseCases: RuleReviewUseCases): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const command = parseRequest(startReviewBodySchema, request.body ?? {});

    response.status(202).json(await ruleReviewUseCases.startReview(command));
  });

  router.get("/", async (_request, response) => {
    response.json(await ruleReviewUseCases.listReviews());
  });

  router.get("/:reviewId", async (request, response) => {
    const { reviewId } = parseRequest(reviewParamsSchema, request.params);

    response.json(await ruleReviewUseCases.getReview(reviewId));
  });

  return router;
}
