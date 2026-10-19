import { Router } from "express";
import { z } from "zod";

import { RISK_PROFILES, RULE_KINDS } from "../../domain/rule";
import { DEFAULT_SENSITIVITY } from "../../domain/rule";
import { MAX_SCORE, MIN_SCORE } from "../../domain/score";
import type { RuleUseCases } from "../../application/rules/ruleUseCases";
import type { WhitelistUseCases } from "../../application/whitelist/whitelistUseCases";
import { ruleDefinitionSchema } from "./ruleDefinitionSchema";
import { optionalText, requiredText, reviewBodySchema, uniqueBy, versionAuthorSchema } from "./schemas";
import { parseRequest } from "./validation";

const ruleParamsSchema = z.object({ ruleId: z.uuid() });
const versionParamsSchema = ruleParamsSchema.extend({ versionId: z.uuid() });
const whitelistParamsSchema = ruleParamsSchema.extend({ clientId: z.string().regex(/^K[0-9]{6}$/) });

const scoreSchema = z.number().int().min(MIN_SCORE).max(MAX_SCORE);

const createRuleSchema = z.object({
  policyId: z
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
  code: requiredText,
  alertType: requiredText,
  kind: z.enum(RULE_KINDS),
  isWhitelistAllowed: z.boolean().default(true),
});

// Kind-specific fields (definition vs. agent prompt) are checked against the rule's kind in the use case.
const createVersionSchema = versionAuthorSchema.extend({
  derivedFromPolicyVersionId: z
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
  definition: ruleDefinitionSchema.nullish().transform((value) => value ?? null),
  agentPrompt: optionalText,
  agentModelId: optionalText,
  humanText: requiredText,
  thresholdRationale: optionalText,
  baseScore: scoreSchema.nullish().transform((value) => value ?? null),
  sensitivity: scoreSchema.default(DEFAULT_SENSITIVITY),
  riskProfiles: z
    .array(z.enum(RISK_PROFILES))
    .min(1)
    .refine((riskProfiles) => uniqueBy(riskProfiles, (riskProfile) => riskProfile), {
      message: "Risk profiles must be unique",
    }),
  legalBases: z
    .array(z.object({ regulationVersionId: z.uuid(), ref: requiredText }))
    .refine(
      (legalBases) => uniqueBy(legalBases, ({ regulationVersionId, ref }) => `${regulationVersionId}|${ref}`),
      {
        message: "Legal bases must be unique",
      },
    ),
});

const activeVersionSchema = z.object({ versionId: z.uuid() });

const addWhitelistEntrySchema = z.object({
  clientId: z.string().regex(/^K[0-9]{6}$/),
  reason: requiredText,
  createdBy: z.uuid(),
});

export function createRulesRouter(ruleUseCases: RuleUseCases, whitelistUseCases: WhitelistUseCases): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const rule = parseRequest(createRuleSchema, request.body);

    response.status(201).json(await ruleUseCases.createRule(rule));
  });

  router.get("/", async (_request, response) => {
    response.json(await ruleUseCases.listRules());
  });

  router.get("/:ruleId", async (request, response) => {
    const { ruleId } = parseRequest(ruleParamsSchema, request.params);

    response.json(await ruleUseCases.getRule(ruleId));
  });

  router.post("/:ruleId/enable", async (request, response) => {
    const { ruleId } = parseRequest(ruleParamsSchema, request.params);

    response.json(await ruleUseCases.enableRule(ruleId));
  });

  router.post("/:ruleId/disable", async (request, response) => {
    const { ruleId } = parseRequest(ruleParamsSchema, request.params);

    response.json(await ruleUseCases.disableRule(ruleId));
  });

  router.put("/:ruleId/active-version", async (request, response) => {
    const { ruleId } = parseRequest(ruleParamsSchema, request.params);
    const { versionId } = parseRequest(activeVersionSchema, request.body);

    response.json(await ruleUseCases.setActiveVersion(ruleId, versionId));
  });

  router.post("/:ruleId/versions", async (request, response) => {
    const { ruleId } = parseRequest(ruleParamsSchema, request.params);
    const version = parseRequest(createVersionSchema, request.body);

    response.status(201).json(await ruleUseCases.createVersion({ ...version, ruleId }));
  });

  router.get("/:ruleId/versions", async (request, response) => {
    const { ruleId } = parseRequest(ruleParamsSchema, request.params);

    response.json(await ruleUseCases.listVersions(ruleId));
  });

  router.get("/:ruleId/versions/:versionId", async (request, response) => {
    const { ruleId, versionId } = parseRequest(versionParamsSchema, request.params);

    response.json(await ruleUseCases.getVersion(ruleId, versionId));
  });

  router.post("/:ruleId/versions/:versionId/submit", async (request, response) => {
    const { ruleId, versionId } = parseRequest(versionParamsSchema, request.params);

    response.json(await ruleUseCases.submitVersionForReview(ruleId, versionId));
  });

  router.post("/:ruleId/versions/:versionId/review", async (request, response) => {
    const { ruleId, versionId } = parseRequest(versionParamsSchema, request.params);
    const review = parseRequest(reviewBodySchema, request.body);

    response.json(await ruleUseCases.reviewVersion(ruleId, versionId, review));
  });

  router.get("/:ruleId/whitelist", async (request, response) => {
    const { ruleId } = parseRequest(ruleParamsSchema, request.params);

    response.json(await whitelistUseCases.listEntries(ruleId));
  });

  router.post("/:ruleId/whitelist", async (request, response) => {
    const { ruleId } = parseRequest(ruleParamsSchema, request.params);
    const entry = parseRequest(addWhitelistEntrySchema, request.body);

    response.status(201).json(await whitelistUseCases.addEntry({ ...entry, ruleId }));
  });

  router.delete("/:ruleId/whitelist/:clientId", async (request, response) => {
    const key = parseRequest(whitelistParamsSchema, request.params);

    await whitelistUseCases.removeEntry(key);
    response.status(204).end();
  });

  return router;
}
