import { getCurrentUser } from "@/config/currentUser";
import {
  draftingJobDtoSchema,
  draftingJobPageDtoSchema,
  toDraftingJob,
} from "@/features/draftingJobs/api/dto";
import type { DraftingJob } from "@/features/draftingJobs/types";
import { fetchPolicyWithVersions } from "@/features/policies/api/dto";
import { livePoliciesService } from "@/features/policies/api/live";
import { liveRegulationsService } from "@/features/regulations/api/live";
import { liveRulesService, loadPolicyRules } from "@/features/rules/api/live";
import type { Rule } from "@/features/rules/types";
import { ApiError } from "@/lib/apiError";
import { assertUnreachable } from "@/lib/assertUnreachable";
import { requestJson } from "@/lib/httpClient";

import type { RegulationSource, RegulationTarget } from "../types";
import type { WizardService } from "./contract";

const MARKDOWN_FILE_PATTERN = /\.(md|markdown)$/i;

type SourceBody = { kind: "text" | "markdown"; content: string } | { kind: "url"; url: string };

function throwUnsupported(message: string): never {
  throw new ApiError({ kind: "unsupported", message });
}

function throwValidation(message: string): never {
  throw new ApiError({ kind: "validation", message });
}

function throwInvalidResponse(message: string): never {
  throw new ApiError({ kind: "invalid_response", message });
}

async function buildSourceBody(source: RegulationSource): Promise<SourceBody> {
  switch (source.kind) {
    case "text":
      return { kind: "text", content: source.text };
    case "file": {
      // The UI accepts only Markdown; this is the safety net.
      if (!MARKDOWN_FILE_PATTERN.test(source.file.name)) {
        return throwUnsupported("Only Markdown files are supported as a regulation file.");
      }
      const content = (await source.file.text()).trim();
      return content === ""
        ? throwValidation(`The file ${source.file.name} is empty.`)
        : { kind: "markdown", content };
    }
    case "url":
      return { kind: "url", url: source.url };
    default:
      return assertUnreachable(source);
  }
}

function buildRegulationBody(target: RegulationTarget, source: SourceBody) {
  switch (target.kind) {
    case "existing":
      return { id: target.regulationId };
    case "new":
      return {
        code: target.code,
        title: target.title,
        kind: target.regulationKind,
        sourceUrl: target.sourceUrl,
      };
    case "fromUrl":
      return source.kind === "url"
        ? undefined
        : throwValidation("Only a URL source can derive the regulation from the page it loads.");
    default:
      return assertUnreachable(target);
  }
}

async function findRulesJob(policyId: string): Promise<DraftingJob | null> {
  const { versions } = await fetchPolicyWithVersions(policyId);
  const approvedVersion = versions.findLast((version) => version.status === "approved");
  if (!approvedVersion) {
    return null;
  }
  const query = new URLSearchParams({
    kind: "rules_from_policy",
    policyVersionId: approvedVersion.id,
    limit: "1",
  });
  const { items } = await requestJson({ path: `/drafting-jobs?${query}`, schema: draftingJobPageDtoSchema });
  const [newestJob] = items;
  return newestJob ? toDraftingJob(newestJob) : null;
}

function replaceRules(rules: Rule[], updatedRules: Rule[]): Rule[] {
  const updatedRuleById = new Map(updatedRules.map((rule) => [rule.id, rule]));
  return rules.map((rule) => updatedRuleById.get(rule.id) ?? rule);
}

async function loadRulesOfPolicies(policyIds: string[]): Promise<Rule[]> {
  const rulesByPolicy = await Promise.all(policyIds.map((policyId) => loadPolicyRules(policyId)));
  return rulesByPolicy.flat();
}

export const liveWizardService: WizardService = {
  capabilities: {
    isAvailable: true,
    canFetchUrl: true,
  },

  // The source is read before anything is sent, so an unsupported or empty file creates no job.
  async startPolicyDrafting({ source, regulation, versionLabel }) {
    const sourceBody = await buildSourceBody(source);
    const job = await requestJson({
      path: "/drafting-jobs",
      method: "POST",
      jsonBody: {
        source: sourceBody,
        regulation: buildRegulationBody(regulation, sourceBody),
        versionLabel,
        createdBy: getCurrentUser().id,
      },
      schema: draftingJobDtoSchema,
    });
    return toDraftingJob(job);
  },

  async loadPolicyDraft({ id, regulationId, policyIds }) {
    if (regulationId === null) {
      return throwInvalidResponse(`Drafting job ${id} succeeded without a regulation.`);
    }
    const [regulation, policies] = await Promise.all([
      liveRegulationsService.loadRegulation(regulationId),
      Promise.all(policyIds.map((policyId) => livePoliciesService.loadPolicy(policyId))),
    ]);
    return { regulation, policies };
  },

  approvePolicyDraft(policyId) {
    return livePoliciesService.approvePolicy({ policyId, approvedBy: getCurrentUser().name });
  },

  async findRulesJobs(policyIds) {
    const jobs = await Promise.all(policyIds.map(findRulesJob));
    return jobs.filter((job) => job !== null);
  },

  loadDraftedRules: loadRulesOfPolicies,

  // Same semantics as the mock: rules nobody approved or rejected go to review, none stays a draft.
  async finishRuleReview(policyIds) {
    const rules = await loadRulesOfPolicies(policyIds);
    const submittedRules = await Promise.all(
      rules
        .filter((rule) => rule.status === "draft")
        .map((rule) => liveRulesService.submitRuleForReview(rule.id)),
    );
    return replaceRules(rules, submittedRules);
  },
};
