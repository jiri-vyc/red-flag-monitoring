import { getCurrentUser } from "@/config/currentUser";

import { ApiError } from "@/lib/apiError";

import { readMockDatabase, resetMockDatabase, writeMockDatabase } from "../store/mockDatabase";
import { mockPoliciesService } from "./policies.mock";

jest.mock("../latency", () => ({ simulateLatency: () => Promise.resolve() }));

describe("mock policies version history", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockDatabase();
  });

  it("seeds a history whose latest version matches the policy status, text and legal bases", async () => {
    const policies = await mockPoliciesService.loadPolicies();

    for (const policy of policies) {
      const latestVersion = policy.versions.at(-1);
      expect(latestVersion).toMatchObject({
        state: policy.status,
        text: policy.text,
        legalBases: policy.legalBases,
      });
      expect(policy.versions.map(({ versionNumber }) => versionNumber)).toEqual(
        policy.versions.map((_, index) => index + 1),
      );
    }
    expect(policies.some((policy) => policy.versions.length > 1)).toBe(true);
  });

  it("saves an edit as a new draft version and approves only the latest one", async () => {
    const draftPolicy = readMockDatabase().policies.find((policy) => policy.status === "draft")!;

    const edited = await mockPoliciesService.updatePolicyText({
      policyId: draftPolicy.id,
      text: "Nový text",
    });
    const { policy: approved } = await mockPoliciesService.approvePolicy({
      policyId: draftPolicy.id,
      approvedBy: "Petr Svoboda",
    });

    expect(edited.versions).toHaveLength(draftPolicy.versions.length + 1);
    expect(edited.versions.at(-1)).toMatchObject({
      state: "draft",
      createdVia: "manual",
      text: "Nový text",
      createdBy: getCurrentUser().name,
    });
    expect(approved.versions.map(({ state }) => state)).toEqual(["draft", "approved"]);
    expect(approved.versions.at(-1)).toMatchObject({
      reviewedBy: "Petr Svoboda",
      reviewedAt: approved.approvedAt,
    });
  });
});

describe("mock policies deletion", () => {
  const deletedBy = getCurrentUser().name;

  beforeEach(() => {
    window.localStorage.clear();
    resetMockDatabase();
  });

  it("deletes a never-approved policy no rule derives from", async () => {
    const database = readMockDatabase();
    const draftPolicy = database.policies.find((policy) => policy.status === "draft")!;
    // A fresh id, so no seeded rule derives from it.
    const freshPolicy = { ...draftPolicy, id: "policy-fresh-draft" };
    writeMockDatabase({ ...database, policies: [...database.policies, freshPolicy] });

    await mockPoliciesService.deletePolicy({ policyId: freshPolicy.id, deletedBy });

    expect(readMockDatabase().policies.some((policy) => policy.id === freshPolicy.id)).toBe(false);
    expect(mockPoliciesService.capabilities.canDeletePolicy).toBe(true);
  });

  it("refuses an approved policy and keeps it", async () => {
    const approvedPolicy = readMockDatabase().policies.find((policy) => policy.status === "approved")!;

    await expect(
      mockPoliciesService.deletePolicy({ policyId: approvedPolicy.id, deletedBy }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(readMockDatabase().policies.some((policy) => policy.id === approvedPolicy.id)).toBe(true);
  });

  it("refuses a draft policy that a rule derives from", async () => {
    const database = readMockDatabase();
    const draftPolicy = database.policies.find((policy) => policy.status === "draft")!;
    const [firstRule, ...otherRules] = database.rules;
    writeMockDatabase({ ...database, rules: [{ ...firstRule!, policyId: draftPolicy.id }, ...otherRules] });

    await expect(
      mockPoliciesService.deletePolicy({ policyId: draftPolicy.id, deletedBy }),
    ).rejects.toMatchObject({ kind: "validation", message: expect.stringContaining("derived_rules") });
  });
});
