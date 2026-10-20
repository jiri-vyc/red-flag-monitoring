import type { PolicyVersionState } from "../types";

/**
 * The version a policy's status, text, legal bases and approval come from (BE-11), for backend DTOs and web
 * versions alike (oldest first; `getState` reads the version status):
 * - the latest version while it is a draft, pending review or approved: that wording is being worked on or in force;
 * - after a rejected (or, defensively, superseded) latest version, the latest approved one, which stays in force;
 * - the latest version when none was ever approved, so a rejected first wording stays a draft to rework.
 */
export function findCurrentVersion<TVersion>(
  versions: readonly TVersion[],
  getState: (version: TVersion) => PolicyVersionState,
): TVersion | undefined {
  const latestVersion = versions.at(-1);
  if (latestVersion === undefined) {
    return undefined;
  }
  const latestState = getState(latestVersion);
  if (latestState !== "rejected" && latestState !== "superseded") {
    return latestVersion;
  }
  return versions.findLast((version) => getState(version) === "approved") ?? latestVersion;
}
