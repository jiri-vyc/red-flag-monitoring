import { z } from "zod";

import { policySchema } from "@/features/policies/types";
import { regulationSchema } from "@/features/regulations/types";
import { ruleSchema } from "@/features/rules/types";
import { assertUnreachable } from "@/lib/assertUnreachable";
import { requestJson } from "@/lib/httpClient";

import type { GeneratePolicyInput, RegulationSource } from "../types";
import type { WizardService } from "./contract";

const policyDraftResultSchema = z.object({ regulation: regulationSchema, policy: policySchema });
const policyDraftPath = (policyId: string) => `/wizard/policy-drafts/${encodeURIComponent(policyId)}`;

function appendRegulationSource(formBody: FormData, source: RegulationSource): void {
  switch (source.kind) {
    case "file":
      formBody.append("file", source.file);
      return;
    case "url":
      formBody.append("url", source.url);
      return;
    case "text":
      formBody.append("text", source.text);
      return;
    default:
      assertUnreachable(source);
  }
}

function buildPolicyDraftForm({ source, regulationName }: GeneratePolicyInput): FormData {
  const formBody = new FormData();
  formBody.append("regulationName", regulationName);
  appendRegulationSource(formBody, source);
  return formBody;
}

export const liveWizardService: WizardService = {
  generatePolicyDraft: (input) =>
    requestJson({
      path: "/wizard/policy-drafts",
      method: "POST",
      formBody: buildPolicyDraftForm(input),
      schema: policyDraftResultSchema,
    }),
  generateRules: (policyId) =>
    requestJson({ path: `${policyDraftPath(policyId)}/rules`, method: "POST", schema: z.array(ruleSchema) }),
  finishRuleReview: (policyId) =>
    requestJson({ path: `${policyDraftPath(policyId)}/finish`, method: "POST", schema: z.array(ruleSchema) }),
};
