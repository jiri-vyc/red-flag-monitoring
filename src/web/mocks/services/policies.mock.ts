import type { PoliciesService } from "@/features/policies/api/contract";
import { ApiError } from "@/lib/apiError";

import { simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import { readMockDatabase, writeMockDatabase, type MockPolicyRecord } from "../store/mockDatabase";
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

export const mockPoliciesService: PoliciesService = {
  async loadPolicies() {
    await simulateLatency();
    const database = readMockDatabase();
    return database.policies.map((record) => mapPolicyRecord(record, database));
  },

  async loadPolicy(policyId) {
    await simulateLatency();
    return mapPolicyRecord(findPolicyRecord(policyId), readMockDatabase());
  },

  async updatePolicyText({ policyId, text }) {
    await simulateLatency();
    const record = findPolicyRecord(policyId);
    assertPolicyIsDraft(record);
    return persistPolicyRecord({ ...record, text, updatedAt: new Date().toISOString() });
  },

  async approvePolicy({ policyId, approvedBy }) {
    await simulateLatency();
    const record = findPolicyRecord(policyId);
    assertPolicyIsDraft(record);
    const now = new Date().toISOString();
    return persistPolicyRecord({
      ...record,
      status: "approved",
      approvedBy,
      approvedAt: now,
      updatedAt: now,
    });
  },
};
