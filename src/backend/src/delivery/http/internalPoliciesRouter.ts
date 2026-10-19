import { Router } from "express";
import { z } from "zod";

import type { InternalPolicyUseCases } from "../../application/internalPolicies/internalPolicyUseCases";
import { optionalText, requiredText, reviewBodySchema, uniqueBy, versionAuthorSchema } from "./schemas";
import { parseRequest } from "./validation";

const policyParamsSchema = z.object({ policyId: z.uuid() });
const versionParamsSchema = policyParamsSchema.extend({ versionId: z.uuid() });

const createPolicySchema = z.object({ code: requiredText, title: requiredText });

const createVersionSchema = versionAuthorSchema.extend({
  body: requiredText,
  legalBases: z
    .array(z.object({ regulationVersionId: z.uuid(), ref: optionalText }))
    .default([])
    .refine(
      (legalBases) => uniqueBy(legalBases, ({ regulationVersionId, ref }) => `${regulationVersionId}|${ref}`),
      {
        message: "Legal bases must be unique",
      },
    ),
});

export function createInternalPoliciesRouter(internalPolicyUseCases: InternalPolicyUseCases): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const policy = parseRequest(createPolicySchema, request.body);

    response.status(201).json(await internalPolicyUseCases.createPolicy(policy));
  });

  router.get("/", async (_request, response) => {
    response.json(await internalPolicyUseCases.listPolicies());
  });

  router.get("/:policyId", async (request, response) => {
    const { policyId } = parseRequest(policyParamsSchema, request.params);

    response.json(await internalPolicyUseCases.getPolicy(policyId));
  });

  router.post("/:policyId/versions", async (request, response) => {
    const { policyId } = parseRequest(policyParamsSchema, request.params);
    const version = parseRequest(createVersionSchema, request.body);

    response.status(201).json(await internalPolicyUseCases.createVersion({ ...version, policyId }));
  });

  router.get("/:policyId/versions", async (request, response) => {
    const { policyId } = parseRequest(policyParamsSchema, request.params);

    response.json(await internalPolicyUseCases.listVersions(policyId));
  });

  router.get("/:policyId/versions/:versionId", async (request, response) => {
    const { policyId, versionId } = parseRequest(versionParamsSchema, request.params);

    response.json(await internalPolicyUseCases.getVersion(policyId, versionId));
  });

  router.post("/:policyId/versions/:versionId/submit", async (request, response) => {
    const { policyId, versionId } = parseRequest(versionParamsSchema, request.params);

    response.json(await internalPolicyUseCases.submitVersionForReview(policyId, versionId));
  });

  router.post("/:policyId/versions/:versionId/review", async (request, response) => {
    const { policyId, versionId } = parseRequest(versionParamsSchema, request.params);
    const review = parseRequest(reviewBodySchema, request.body);

    response.json(await internalPolicyUseCases.reviewVersion(policyId, versionId, review));
  });

  return router;
}
