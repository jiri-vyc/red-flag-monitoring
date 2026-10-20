import type { PolicyVersionState } from "../types";
import { findCurrentVersion } from "./currentVersion";

type Version = { versionNumber: number; state: PolicyVersionState };

function createVersions(...states: PolicyVersionState[]): Version[] {
  return states.map((state, index) => ({ versionNumber: index + 1, state }));
}

describe("findCurrentVersion (BE-11)", () => {
  it.each<{ name: string; states: PolicyVersionState[]; expected: number | undefined }>([
    { name: "no version", states: [], expected: undefined },
    { name: "a latest draft", states: ["approved", "draft"], expected: 2 },
    { name: "a latest pending review", states: ["approved", "pending_review"], expected: 2 },
    { name: "a latest approved", states: ["superseded", "approved"], expected: 2 },
    { name: "a latest rejected after an approved", states: ["approved", "rejected"], expected: 1 },
    {
      name: "a latest superseded after an approved",
      states: ["superseded", "approved", "superseded"],
      expected: 2,
    },
    {
      name: "the latest of several approved",
      states: ["approved", "approved", "rejected", "rejected"],
      expected: 2,
    },
    { name: "a rejected first wording", states: ["rejected"], expected: 1 },
    { name: "only rejected wordings", states: ["rejected", "rejected"], expected: 2 },
  ])("picks the right version for $name", ({ states, expected }) => {
    const versions = createVersions(...states);

    expect(findCurrentVersion(versions, (version) => version.state)?.versionNumber).toBe(expected);
  });
});
