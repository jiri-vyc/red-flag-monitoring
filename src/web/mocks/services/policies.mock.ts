import { getCurrentUser } from "@/config/currentUser";
import type { PoliciesService } from "@/features/policies/api/contract";
import { findPolicyDeletionBlocker } from "@/features/policies/domain/policyDeletion";
import type { PolicyVersion } from "@/features/policies/types";
import { ApiError } from "@/lib/apiError";

import { simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import { readMockDatabase, writeMockDatabase, type MockPolicyRecord } from "../store/mockDatabase";
import { addMockDraftingJob, advanceMockDraftingJobs } from "./draftingJobs.mock";
import { mapPolicyRecord } from "./mappers";

function findPolicyRecord(policyId: string): MockPolicyRecord {
  const record = readMockDatabase().policies.find((policy) => policy.id === policyId);
  return record ?? throwMockNotFound("Internal policy", policyId);
}

function assertPolicyIsDraft(record: MockPolicyRecord): void {
  if (record.status !== "draft") {
    throw new ApiError({ kind: "validation", message: "Only draft policies can be changed." });
  }
}

function persistPolicyRecord(updatedRecord: MockPolicyRecord) {
  const database = readMockDatabase();
  const policies = database.policies.map((policy) =>
    policy.id === updatedRecord.id ? updatedRecord : policy,
  );
  const updatedDatabase = { ...database, policies };
  writeMockDatabase(updatedDatabase);
  return mapPolicyRecord(updatedRecord, updatedDatabase);
}

// M17, as in the live backend: versions are immutable, so an edited text becomes a new draft version.
function appendDraftVersion(record: MockPolicyRecord, text: string, now: string): PolicyVersion[] {
  const draftVersion: PolicyVersion = {
    versionNumber: (record.versions.at(-1)?.versionNumber ?? 0) + 1,
    state: "draft",
    createdVia: "manual",
    text,
    legalBases: record.legalBases,
    createdBy: getCurrentUser().name,
    createdAt: now,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
  };
  return [...record.versions, draftVersion];
}

// Only drafts can be approved and an approved policy cannot be edited, so no earlier version is approved to supersede.
function approveLatestVersion(record: MockPolicyRecord, approvedBy: string, now: string): PolicyVersion[] {
  const latestVersionNumber = record.versions.at(-1)?.versionNumber;
  return record.versions.map((version) =>
    version.versionNumber === latestVersionNumber
      ? { ...version, state: "approved", reviewedBy: approvedBy, reviewedAt: now }
      : version,
  );
}

export const mockPoliciesService: PoliciesService = {
  capabilities: { canDeletePolicy: true },

  async loadPolicies() {
    await simulateLatency();
    const database = readMockDatabase();
    return database.policies.map((record) => mapPolicyRecord(record, database));
  },

  async loadPolicy(policyId) {
    await simulateLatency();
    return mapPolicyRecord(findPolicyRecord(policyId), readMockDatabase());
  },

  async loadPolicyNames() {
    await simulateLatency();
    const { policies } = readMockDatabase();
    return Object.fromEntries(policies.map((policy) => [policy.id, policy.name]));
  },

  async updatePolicyText({ policyId, text }) {
    await simulateLatency();
    const record = findPolicyRecord(policyId);
    assertPolicyIsDraft(record);
    const now = new Date().toISOString();
    return persistPolicyRecord({
      ...record,
      text,
      updatedAt: now,
      versions: appendDraftVersion(record, text, now),
    });
  },

  async approvePolicy({ policyId, approvedBy }) {
    await simulateLatency();
    const record = findPolicyRecord(policyId);
    assertPolicyIsDraft(record);
    const now = new Date().toISOString();
    const policy = persistPolicyRecord({
      ...record,
      status: "approved",
      approvedBy,
      approvedAt: now,
      updatedAt: now,
      versions: approveLatestVersion(record, approvedBy, now),
    });
    const database = advanceMockDraftingJobs();
    const parentJob = database.draftingJobs.find(
      ({ job }) => job.kind === "policy_from_regulation" && job.policyIds.includes(policyId),
    )?.job;
    const enqueued = addMockDraftingJob(database, {
      parentJobId: parentJob?.id ?? null,
      sourceKind: null,
      sourceUrl: null,
      regulationId: parentJob?.regulationId ?? record.legalBases[0]?.regulationId ?? null,
      input: { kind: "rules_from_policy", policyId },
    });
    writeMockDatabase(enqueued.database);
    return { policy, rulesJob: enqueued.job };
  },

  // The UI only offers deletion when nothing blocks it; this check is the safety net.
  async deletePolicy({ policyId }) {
    await simulateLatency();
    const database = readMockDatabase();
    const blocker = findPolicyDeletionBlocker(mapPolicyRecord(findPolicyRecord(policyId), database));
    if (blocker !== null) {
      throw new ApiError({
        kind: "validation",
        message: `Policy "${policyId}" cannot be deleted (${blocker}).`,
      });
    }
    // The policy's versions live inside its record, so dropping it removes them too. The wizard run that drafted
    // it no longer lists it, so the run is not offered for resuming once none of its drafts is left.
    writeMockDatabase({
      ...database,
      policies: database.policies.filter((policy) => policy.id !== policyId),
      draftingJobs: database.draftingJobs.map((record) => ({
        ...record,
        job: { ...record.job, policyIds: record.job.policyIds.filter((id) => id !== policyId) },
      })),
    });
  },
};
