import type { PolicyVersion, PolicyVersionState } from "../types";
import { findPolicyDeletionBlocker } from "./policyDeletion";

function createVersion(versionNumber: number, state: PolicyVersionState): PolicyVersion {
  return {
    versionNumber,
    state,
    createdVia: "manual",
    text: `v${versionNumber}`,
    legalBases: [],
    createdBy: "Author",
    createdAt: "2026-10-19T10:00:00.000Z",
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
  };
}

describe("findPolicyDeletionBlocker", () => {
  it("allows deleting a policy that was never approved and has no rules", () => {
    const versions = [createVersion(1, "rejected"), createVersion(2, "draft")];

    expect(findPolicyDeletionBlocker({ versions, ruleIds: [] })).toBeNull();
    expect(
      findPolicyDeletionBlocker({ versions: [createVersion(1, "pending_review")], ruleIds: [] }),
    ).toBeNull();
  });

  it("refuses a policy with an approved or superseded version", () => {
    expect(findPolicyDeletionBlocker({ versions: [createVersion(1, "approved")], ruleIds: [] })).toBe(
      "approved_version",
    );
    expect(
      findPolicyDeletionBlocker({
        versions: [createVersion(1, "superseded"), createVersion(2, "rejected")],
        ruleIds: [],
      }),
    ).toBe("approved_version");
  });

  it("refuses a policy that rules are derived from", () => {
    expect(findPolicyDeletionBlocker({ versions: [createVersion(1, "draft")], ruleIds: ["rule-1"] })).toBe(
      "derived_rules",
    );
  });
});
