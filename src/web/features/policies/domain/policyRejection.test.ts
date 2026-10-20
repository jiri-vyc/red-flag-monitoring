import type { PolicyVersion, PolicyVersionState } from "../types";
import { findRejectedLatestVersion, isPolicyRejected } from "./policyRejection";

function createVersions(...states: PolicyVersionState[]): PolicyVersion[] {
  return states.map((state, index) => ({
    versionNumber: index + 1,
    state,
    createdVia: "wizard",
    text: `Text v${index + 1}`,
    legalBases: [],
    createdBy: "Jana Nováková",
    createdAt: "2026-10-18T10:00:00.000Z",
    reviewedBy: state === "draft" ? null : "Petr Svoboda",
    reviewedAt: state === "draft" ? null : "2026-10-18T12:00:00.000Z",
    reviewComment: state === "rejected" ? `Důvod v${index + 1}` : null,
  }));
}

describe("findRejectedLatestVersion", () => {
  it.each<{ name: string; states: PolicyVersionState[]; expected: number | undefined }>([
    { name: "no version", states: [], expected: undefined },
    { name: "a latest draft after a rejection", states: ["rejected", "draft"], expected: undefined },
    { name: "a latest approved", states: ["rejected", "approved"], expected: undefined },
    { name: "a rejected first wording", states: ["rejected"], expected: 1 },
    { name: "a rejection after an approved version", states: ["approved", "rejected"], expected: 2 },
  ])("finds the rejection for $name", ({ states, expected }) => {
    const policy = { versions: createVersions(...states) };

    expect(findRejectedLatestVersion(policy)?.versionNumber).toBe(expected);
    expect(isPolicyRejected(policy)).toBe(expected !== undefined);
  });

  it("carries the reason as the review comment", () => {
    expect(findRejectedLatestVersion({ versions: createVersions("approved", "rejected") })?.reviewComment).toBe(
      "Důvod v2",
    );
  });
});
