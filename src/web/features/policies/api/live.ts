import { getCurrentUser, formatUserName } from "@/config/currentUser";
import { draftingJobDtoSchema, toDraftingJob } from "@/features/draftingJobs/api/dto";
import {
  fetchRegulationsWithVersions,
  indexRegulationIdByVersionId,
  toLegalBases,
} from "@/features/regulations/api/dto";
import { fetchRuleDtos, type RuleDto } from "@/features/rules/api/dto";
import { ApiError } from "@/lib/apiError";
import { requestJson } from "@/lib/httpClient";

import { findCurrentVersion } from "../domain/currentVersion";
import type { Policy, PolicyStatus, PolicyVersion } from "../types";
import type { PoliciesService } from "./contract";
import {
  fetchPoliciesWithVersions,
  fetchPolicyDtos,
  fetchPolicyWithVersions,
  internalPolicyPath,
  internalPolicyVersionDtoSchema,
  type InternalPolicyVersionDto,
  type InternalPolicyWithVersionsDto,
} from "./dto";

const versionPath = (policyId: string, versionId: string) =>
  `${internalPolicyPath(policyId)}/versions/${encodeURIComponent(versionId)}`;

type PolicyRelations = { rules: RuleDto[]; regulationIdByVersionId: Map<string, string> };

function throwUnsupported(message: string): never {
  throw new ApiError({ kind: "unsupported", message });
}

function throwValidation(message: string): never {
  throw new ApiError({ kind: "validation", message });
}

/** The web knows draft and approved only: a current version that is not approved (draft, pending, rejected) is a draft. */
function toPolicyStatus(currentVersion: InternalPolicyVersionDto | undefined): PolicyStatus {
  return currentVersion?.status === "approved" ? "approved" : "draft";
}

function findCurrentVersionDto(versions: InternalPolicyVersionDto[]): InternalPolicyVersionDto | undefined {
  return findCurrentVersion(versions, (version) => version.status);
}

function toPolicyVersion(
  version: InternalPolicyVersionDto,
  regulationIdByVersionId: PolicyRelations["regulationIdByVersionId"],
): PolicyVersion {
  return {
    versionNumber: version.versionNo,
    state: version.status,
    createdVia: version.createdVia,
    text: version.body,
    legalBases: toLegalBases(version.legalBases, regulationIdByVersionId),
    createdBy: formatUserName(version.createdBy),
    createdAt: version.createdAt,
    reviewedBy: version.reviewedBy === null ? null : formatUserName(version.reviewedBy),
    reviewedAt: version.reviewedAt,
    reviewComment: version.reviewComment,
  };
}

function toPolicy({ policy, versions }: InternalPolicyWithVersionsDto, relations: PolicyRelations): Policy {
  const firstVersion = versions.at(0);
  const latestVersion = versions.at(-1);
  const currentVersion = findCurrentVersionDto(versions);
  const isApproved = currentVersion?.status === "approved";
  return {
    id: policy.id,
    name: policy.title,
    legalBases: toLegalBases(currentVersion?.legalBases ?? [], relations.regulationIdByVersionId),
    status: toPolicyStatus(currentVersion),
    origin: firstVersion?.createdVia === "manual" ? "manual" : "generated",
    text: currentVersion?.body ?? "",
    createdAt: firstVersion?.createdAt ?? "",
    // A rejection is the latest change, even when an older approved version stays in force.
    updatedAt: latestVersion?.reviewedAt ?? latestVersion?.createdAt ?? "",
    approvedBy: isApproved && currentVersion.reviewedBy ? formatUserName(currentVersion.reviewedBy) : null,
    approvedAt: isApproved ? currentVersion.reviewedAt : null,
    ruleIds: relations.rules.filter((rule) => rule.policyId === policy.id).map((rule) => rule.id),
    versions: versions.map((version) => toPolicyVersion(version, relations.regulationIdByVersionId)),
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

function submitVersion(policyId: string, versionId: string) {
  return requestJson({
    path: `${versionPath(policyId, versionId)}/submit`,
    method: "POST",
    schema: internalPolicyVersionDtoSchema,
  });
}

// `nullish`: a backend that still drafts rules inline answers without `rulesJob`.
const approvedPolicyVersionDtoSchema = internalPolicyVersionDtoSchema.extend({
  rulesJob: draftingJobDtoSchema.nullish(),
});

export const livePoliciesService: PoliciesService = {
  capabilities: { canDeletePolicy: false },

  async loadPolicies() {
    const [policiesWithVersions, relations] = await Promise.all([
      fetchPoliciesWithVersions(),
      loadRelations(),
    ]);
    return policiesWithVersions.map((policyWithVersions) => toPolicy(policyWithVersions, relations));
  },

  loadPolicy,

  // A single request: the name is the policy title, as in `toPolicy`.
  async loadPolicyNames() {
    const policies = await fetchPolicyDtos();
    return Object.fromEntries(policies.map((policy) => [policy.id, policy.title]));
  },

  // M17: versions are immutable, so an edited text is saved as a new draft version with the same legal basis.
  async updatePolicyText({ policyId, text }) {
    const { versions } = await fetchPolicyWithVersions(policyId);
    await requestJson({
      path: `${internalPolicyPath(policyId)}/versions`,
      method: "POST",
      jsonBody: {
        status: "draft",
        createdVia: "manual",
        createdBy: getCurrentUser().id,
        body: text,
        legalBases: findCurrentVersionDto(versions)?.legalBases ?? [],
      },
      schema: internalPolicyVersionDtoSchema,
    });
    return loadPolicy(policyId);
  },

  // The backend reviews only pending versions, so a draft is submitted first.
  async approvePolicy({ policyId }) {
    const { versions } = await fetchPolicyWithVersions(policyId);
    const latestVersion = versions.at(-1);
    if (!latestVersion || (latestVersion.status !== "draft" && latestVersion.status !== "pending_review")) {
      return throwValidation("The policy has no version awaiting approval. Edit the text to create one.");
    }
    if (latestVersion.status === "draft") {
      await submitVersion(policyId, latestVersion.id);
    }
    const { rulesJob } = await requestJson({
      path: `${versionPath(policyId, latestVersion.id)}/review`,
      method: "POST",
      jsonBody: { decision: "approved", reviewedBy: getCurrentUser().id, reviewComment: null },
      schema: approvedPolicyVersionDtoSchema,
    });
    return { policy: await loadPolicy(policyId), rulesJob: rulesJob ? toDraftingJob(rulesJob) : null };
  },

  // The backend has no policy deletion endpoint yet (todo-web.md). Hidden in the UI; this is the safety net.
  deletePolicy: () => throwUnsupported("Deleting an internal policy is not supported by the API yet."),
};
