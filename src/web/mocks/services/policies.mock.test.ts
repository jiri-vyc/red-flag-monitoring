import { getCurrentUser } from "@/config/currentUser";

import { readMockDatabase, resetMockDatabase } from "../store/mockDatabase";
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
