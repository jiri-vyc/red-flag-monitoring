import { z } from "zod";

import { requestJson } from "@/lib/httpClient";

import { ruleSchema, whitelistEntrySchema } from "../types";
import type { RulesService } from "./contract";

const rulePath = (ruleId: string) => `/rules/${encodeURIComponent(ruleId)}`;
const whitelistPath = (ruleId: string) => `${rulePath(ruleId)}/whitelist`;

function postRuleAction(ruleId: string, action: string, jsonBody?: unknown) {
  return requestJson({ path: `${rulePath(ruleId)}/${action}`, method: "POST", jsonBody, schema: ruleSchema });
}

export const liveRulesService: RulesService = {
  loadRules: () => requestJson({ path: "/rules", schema: z.array(ruleSchema) }),
  loadRule: (ruleId) => requestJson({ path: rulePath(ruleId), schema: ruleSchema }),
  createManualRule: (input) =>
    requestJson({ path: "/rules", method: "POST", jsonBody: input, schema: ruleSchema }),
  submitRuleForReview: (ruleId) => postRuleAction(ruleId, "submit"),
  approveRule: ({ ruleId, reviewer }) => postRuleAction(ruleId, "approve", { reviewer }),
  rejectRule: ({ ruleId, reviewer }) => postRuleAction(ruleId, "reject", { reviewer }),
  activateRule: (ruleId) => postRuleAction(ruleId, "activate"),
  deactivateRule: (ruleId) => postRuleAction(ruleId, "deactivate"),
  // Proposed API: POST /rules/:id/versions with { content, config, changeNote, author }.
  createRuleVersion: ({ ruleId, content, config, changeNote, author }) =>
    postRuleAction(ruleId, "versions", { content, config, changeNote, author }),
  updateDraftContent: ({ ruleId, content }) =>
    requestJson({
      path: `${rulePath(ruleId)}/draft`,
      method: "PATCH",
      jsonBody: { content },
      schema: ruleSchema,
    }),
  // Proposed API: GET/POST /rules/:id/whitelist, DELETE /rules/:id/whitelist/:clientId.
  getWhitelist: (ruleId) =>
    requestJson({ path: whitelistPath(ruleId), schema: z.array(whitelistEntrySchema) }),
  addWhitelistEntry: ({ ruleId, clientId, reason, author }) =>
    requestJson({
      path: whitelistPath(ruleId),
      method: "POST",
      jsonBody: { clientId, reason, author },
      schema: whitelistEntrySchema,
    }),
  removeWhitelistEntry: async ({ ruleId, clientId }) => {
    // The response body (none for 204) is not used.
    await requestJson({
      path: `${whitelistPath(ruleId)}/${encodeURIComponent(clientId)}`,
      method: "DELETE",
      schema: z.unknown(),
    });
  },
};
