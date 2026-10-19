import type { InternalPolicy, InternalPolicyVersion } from "../../domain/internalPolicy";
import type { VersionReview } from "../../domain/versionStatus";
import type { NewDraftingJob } from "../drafting/draftingJobPorts";
import type { VersionStatusChange } from "../versionReview";

export type NewInternalPolicy = Omit<InternalPolicy, "id">;
export type NewInternalPolicyVersion = Pick<
  InternalPolicyVersion,
  "policyId" | "body" | "status" | "createdVia" | "createdBy" | "legalBases"
>;

// Applied in one transaction: the reviewed version, the versions it supersedes and the job drafting its rules.
export type PolicyVersionReviewRecord = {
  versionId: string;
  review: VersionReview;
  supersededVersionIds: string[];
  rulesJob: NewDraftingJob | null;
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
  // Returns the ID of the created rules job.
  recordReview(record: PolicyVersionReviewRecord): Promise<string | null>;
}
