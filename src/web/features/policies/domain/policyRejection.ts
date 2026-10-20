import type { Policy, PolicyVersion } from "../types";

/**
 * The latest version when a reviewer rejected it, otherwise undefined. Its review comment is the reason. A rejected
 * latest version is the policy's open decision: the author writes a new version (saving the text creates one),
 * while an older approved version, if any, stays in force (see `findCurrentVersion`).
 */
export function findRejectedLatestVersion(policy: Pick<Policy, "versions">): PolicyVersion | undefined {
  const latestVersion = policy.versions.at(-1);
  return latestVersion?.state === "rejected" ? latestVersion : undefined;
}

export function isPolicyRejected(policy: Pick<Policy, "versions">): boolean {
  return findRejectedLatestVersion(policy) !== undefined;
}
