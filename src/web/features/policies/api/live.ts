import { CURRENT_USER, formatUserName } from "@/config/currentUser";
import {
  fetchRegulationsWithVersions,
  indexRegulationIdByVersionId,
  toLegalBases,
} from "@/features/regulations/api/dto";
import { fetchRuleDtos, type RuleDto } from "@/features/rules/api/dto";
import { ApiError } from "@/lib/apiError";
import { requestJson } from "@/lib/httpClient";

import type { Policy, PolicyStatus } from "../types";
import type { PoliciesService } from "./contract";
import {
  fetchPoliciesWithVersions,
  fetchPolicyWithVersions,
  internalPolicyPath,
  internalPolicyVersionDtoSchema,
  type InternalPolicyVersionDto,
  type InternalPolicyWithVersionsDto,
} from "./dto";

const versionPath = (policyId: string, versionId: string) =>
  `${internalPolicyPath(policyId)}/versions/${encodeURIComponent(versionId)}`;

type PolicyRelations = { rules: RuleDto[]; regulationIdByVersionId: Map<string, string> };

function throwValidation(message: string): never {
  throw new ApiError({ kind: "validation", message });
}

/** The web knows draft and approved only: anything not approved yet (draft, pending, rejected) is a draft. */
function toPolicyStatus(latestVersion: InternalPolicyVersionDto | undefined): PolicyStatus {
  return latestVersion?.status === "approved" ? "approved" : "draft";
}

function toPolicy({ policy, versions }: InternalPolicyWithVersionsDto, relations: PolicyRelations): Policy {
  const firstVersion = versions.at(0);
  const latestVersion = versions.at(-1);
  const isApproved = latestVersion?.status === "approved";
  return {
    id: policy.id,
    name: policy.title,
    legalBases: toLegalBases(latestVersion?.legalBases ?? [], relations.regulationIdByVersionId),
    status: toPolicyStatus(latestVersion),
    origin: firstVersion?.createdVia === "manual" ? "manual" : "generated",
    text: latestVersion?.body ?? "",
    createdAt: firstVersion?.createdAt ?? "",
    updatedAt: latestVersion?.reviewedAt ?? latestVersion?.createdAt ?? "",
    approvedBy: isApproved && latestVersion.reviewedBy ? formatUserName(latestVersion.reviewedBy) : null,
    approvedAt: isApproved ? latestVersion.reviewedAt : null,
    ruleIds: relations.rules.filter((rule) => rule.policyId === policy.id).map((rule) => rule.id),
  };
}

async function loadRelations(): Promise<PolicyRelations> {
  const [rules, regulations] = await Promise.all([fetchRuleDtos(), fetchRegulationsWithVersions()]);
  return { rules, regulationIdByVersionId: indexRegulationIdByVersionId(regulations) };
}

async function loadPolicy(policyId: string): Promise<Policy> {
  const [policyWithVersions, relations] = await Promise.all([
    fetchPolicyWithVersions(policyId),
    loadRelations(),
  ]);
  return toPolicy(policyWithVersions, relations);
}

function postVersionAction(
  policyId: string,
  versionId: string,
  action: "submit" | "review",
  jsonBody?: unknown,
) {
  return requestJson({
    path: `${versionPath(policyId, versionId)}/${action}`,
    method: "POST",
    jsonBody,
    schema: internalPolicyVersionDtoSchema,
  });
}

export const livePoliciesService: PoliciesService = {
  async loadPolicies() {
    const [policiesWithVersions, relations] = await Promise.all([
      fetchPoliciesWithVersions(),
      loadRelations(),
    ]);
    return policiesWithVersions.map((policyWithVersions) => toPolicy(policyWithVersions, relations));
  },

  loadPolicy,

  // M17: versions are immutable, so an edited text is saved as a new draft version with the same legal basis.
  async updatePolicyText({ policyId, text }) {
    const { versions } = await fetchPolicyWithVersions(policyId);
    await requestJson({
      path: `${internalPolicyPath(policyId)}/versions`,
      method: "POST",
      jsonBody: {
        status: "draft",
        createdVia: "manual",
        createdBy: CURRENT_USER.id,
        body: text,
        legalBases: versions.at(-1)?.legalBases ?? [],
      },
      schema: internalPolicyVersionDtoSchema,
    });
    return loadPolicy(policyId);
  },

  // The backend reviews only pending versions, so a draft is submitted first. Approval supersedes older ones.
  async approvePolicy({ policyId }) {
    const latestVersion = (await fetchPolicyWithVersions(policyId)).versions.at(-1);
    if (!latestVersion || (latestVersion.status !== "draft" && latestVersion.status !== "pending_review")) {
      return throwValidation("The policy has no version awaiting approval. Edit the text to create one.");
    }
    if (latestVersion.status === "draft") {
      await postVersionAction(policyId, latestVersion.id, "submit");
    }
    await postVersionAction(policyId, latestVersion.id, "review", {
      decision: "approved",
      reviewedBy: CURRENT_USER.id,
      reviewComment: null,
    });
    return loadPolicy(policyId);
  },
};
