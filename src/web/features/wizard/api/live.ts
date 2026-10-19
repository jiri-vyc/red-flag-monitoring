import { z } from "zod";

import { CURRENT_USER } from "@/config/currentUser";
import { internalPolicyVersionDtoSchema } from "@/features/policies/api/dto";
import { livePoliciesService } from "@/features/policies/api/live";
import { regulationDtoSchema, regulationVersionSummaryDtoSchema } from "@/features/regulations/api/dto";
import { liveRegulationsService } from "@/features/regulations/api/live";
import { liveRulesService, loadPolicyRules } from "@/features/rules/api/live";
import type { Rule } from "@/features/rules/types";
import { ApiError } from "@/lib/apiError";
import { assertUnreachable } from "@/lib/assertUnreachable";
import { requestJson } from "@/lib/httpClient";

import type { RegulationSource, RegulationTarget } from "../types";
import type { WizardService } from "./contract";

const MARKDOWN_FILE_PATTERN = /\.(md|markdown)$/i;

const regulationPath = (regulationId: string) => `/regulations/${encodeURIComponent(regulationId)}`;

function throwUnsupported(message: string): never {
  throw new ApiError({ kind: "unsupported", message });
}

function throwValidation(message: string): never {
  throw new ApiError({ kind: "validation", message });
}

/** The backend stores the wording as plain text (M1): a Markdown file is read in the browser, a URL is not supported. */
async function readRegulationText(source: RegulationSource): Promise<string> {
  switch (source.kind) {
    case "text":
      return source.text;
    case "file": {
      // The UI accepts only Markdown; this is the safety net.
      if (!MARKDOWN_FILE_PATTERN.test(source.file.name)) {
        return throwUnsupported("Only Markdown files are supported as a regulation file.");
      }
      const text = (await source.file.text()).trim();
      return text === "" ? throwValidation(`The file ${source.file.name} is empty.`) : text;
    }
    case "url":
      // BE-02: the backend does not load regulations from a URL. Disabled in the UI (canFetchUrl); the safety net.
      return throwUnsupported("Fetching a regulation from a URL is not supported by the API.");
    default:
      return assertUnreachable(source);
  }
}

async function findRegulationId(target: RegulationTarget): Promise<string> {
  if (target.kind === "existing") {
    return target.regulationId;
  }
  if (target.kind === "fromUrl") {
    // BE-02: no `POST /regulations/import` yet.
    return throwUnsupported("Deriving a regulation from a URL is not supported by the API.");
  }
  const regulation = await requestJson({
    path: "/regulations",
    method: "POST",
    jsonBody: {
      code: target.code,
      title: target.title,
      kind: target.regulationKind,
      sourceUrl: target.sourceUrl,
    },
    schema: regulationDtoSchema,
  });
  return regulation.id;
}

function replaceRules(rules: Rule[], updatedRules: Rule[]): Rule[] {
  const updatedRuleById = new Map(updatedRules.map((rule) => [rule.id, rule]));
  return rules.map((rule) => updatedRuleById.get(rule.id) ?? rule);
}

// Minimal backend flow (draftingUseCases.ts): regulation wording → policy drafts, approved policy → rule drafts.
// The backend generator is a placeholder for now (DummyDraftGenerator, titles start with "[DUMMY]").
export const liveWizardService: WizardService = {
  capabilities: {
    isAvailable: true,
    canFetchUrl: false, // BE-02
  },

  // The text is read before anything is written, so an unsupported or empty source leaves no regulation behind.
  async draftPolicies({ source, regulation, versionLabel }) {
    const fullText = await readRegulationText(source);
    const regulationId = await findRegulationId(regulation);
    const regulationVersion = await requestJson({
      path: `${regulationPath(regulationId)}/versions`,
      method: "POST",
      jsonBody: { label: versionLabel, fullText },
      schema: regulationVersionSummaryDtoSchema,
    });
    const policyVersions = await requestJson({
      path: `${regulationPath(regulationId)}/versions/${encodeURIComponent(regulationVersion.id)}/draft-policies`,
      method: "POST",
      jsonBody: { createdBy: CURRENT_USER.id },
      schema: z.array(internalPolicyVersionDtoSchema),
    });
    const policyIds = [...new Set(policyVersions.map((policyVersion) => policyVersion.policyId))];
    const [regulationModel, policies] = await Promise.all([
      liveRegulationsService.loadRegulation(regulationId),
      Promise.all(policyIds.map((policyId) => livePoliciesService.loadPolicy(policyId))),
    ]);
    return { regulation: regulationModel, policies };
  },

  // The backend drafts the rules while it approves the policy (internalPolicyUseCases.reviewVersion).
  async approvePolicyDraft(policyId) {
    const { policy } = await livePoliciesService.approvePolicy({ policyId, approvedBy: CURRENT_USER.name });
    return { policy, rules: await loadPolicyRules(policyId) };
  },

  // Same semantics as the mock: rules nobody approved or rejected go to review, none stays a draft.
  async finishRuleReview(policyIds) {
    const rulesByPolicy = await Promise.all(policyIds.map((policyId) => loadPolicyRules(policyId)));
    const rules = rulesByPolicy.flat();
    const submittedRules = await Promise.all(
      rules
        .filter((rule) => rule.status === "draft")
        .map((rule) => liveRulesService.submitRuleForReview(rule.id)),
    );
    return replaceRules(rules, submittedRules);
  },
};
