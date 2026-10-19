import type { PolicyLegalBasis } from "./regulation";
import type { ReviewableVersion } from "./versionStatus";

export type InternalPolicy = { id: string; code: string; title: string };

// M8: one markdown body per version. M3: legal bases are optional, a policy can be purely internal.
export type InternalPolicyVersion = ReviewableVersion & {
  policyId: string;
  body: string;
  legalBases: PolicyLegalBasis[];
};
