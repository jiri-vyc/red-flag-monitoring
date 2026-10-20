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

describe("mock policies rejection", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockDatabase();
  });

  it("rejects the latest draft version with the reason as its review comment and keeps the policy a draft", async () => {
    const draftPolicy = readMockDatabase().policies.find((policy) => policy.status === "draft")!;

    const rejected = await mockPoliciesService.rejectPolicy({
      policyId: draftPolicy.id,
      rejectedBy: "Petr Svoboda",
      reason: "  Chybí částkový práh  ",
    });

    expect(rejected.status).toBe("draft");
    expect(rejected.versions).toHaveLength(draftPolicy.versions.length);
    expect(rejected.versions.at(-1)).toMatchObject({
      state: "rejected",
      reviewedBy: "Petr Svoboda",
      reviewComment: "Chybí částkový práh",
    });
  });

  it("refuses an empty reason and a version that is already decided", async () => {
    const draftPolicy = readMockDatabase().policies.find((policy) => policy.status === "draft")!;
    const reject = (reason: string) =>
      mockPoliciesService.rejectPolicy({ policyId: draftPolicy.id, rejectedBy: "Petr Svoboda", reason });

    await expect(reject("   ")).rejects.toMatchObject({ kind: "validation" });
    await reject("Chybí částkový práh");
    await expect(reject("Znovu")).rejects.toMatchObject({ kind: "validation" });
    await expect(
      mockPoliciesService.approvePolicy({ policyId: draftPolicy.id, approvedBy: "Petr Svoboda" }),
    ).rejects.toMatchObject({ kind: "validation" });
  });

  it("lets the author write a new version after a rejection, which can be approved", async () => {
    const draftPolicy = readMockDatabase().policies.find((policy) => policy.status === "draft")!;
    await mockPoliciesService.rejectPolicy({
      policyId: draftPolicy.id,
      rejectedBy: "Petr Svoboda",
      reason: "Chybí částkový práh",
    });

    await mockPoliciesService.updatePolicyText({ policyId: draftPolicy.id, text: "Opravený text" });
    const { policy } = await mockPoliciesService.approvePolicy({
      policyId: draftPolicy.id,
      approvedBy: "Petr Svoboda",
    });

    expect(policy.versions.slice(-2).map(({ state }) => state)).toEqual(["rejected", "approved"]);
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
