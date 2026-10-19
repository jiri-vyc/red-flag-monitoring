import type { InternalPolicy, InternalPolicyVersion } from "../../domain/internalPolicy";
import type { VersionReview } from "../../domain/versionStatus";
import type { VersionStatusChange } from "../versionReview";

export type NewInternalPolicy = Omit<InternalPolicy, "id">;
export type NewInternalPolicyVersion = Pick<
  InternalPolicyVersion,
  "policyId" | "body" | "status" | "createdVia" | "createdBy" | "legalBases"
>;

// Applied in one transaction: the reviewed version and the versions it supersedes.
export type PolicyVersionReviewRecord = {
  versionId: string;
  review: VersionReview;
  supersededVersionIds: string[];
};

export interface InternalPolicyRepository {
  createPolicy(policy: NewInternalPolicy): Promise<InternalPolicy>;
  listPolicies(): Promise<InternalPolicy[]>;
  findPolicy(policyId: string): Promise<InternalPolicy | null>;
  // Assigns the next version_no of the policy.
  createVersion(version: NewInternalPolicyVersion): Promise<InternalPolicyVersion>;
  listVersions(policyId: string): Promise<InternalPolicyVersion[]>;
  findVersion(versionId: string): Promise<InternalPolicyVersion | null>;
  updateVersionStatus(change: VersionStatusChange): Promise<void>;
  recordReview(record: PolicyVersionReviewRecord): Promise<void>;
}
