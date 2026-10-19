import type { InternalPolicy, InternalPolicyVersion } from "../../domain/internalPolicy";
import type { Clock } from "../clock";
import { NotFoundError } from "../errors";
import { createReviewSubmission, createVersionReview, type ReviewInput } from "../versionReview";
import type {
  InternalPolicyRepository,
  NewInternalPolicy,
  NewInternalPolicyVersion,
} from "./internalPolicyRepository";

export class InternalPolicyUseCases {
  constructor(
    private readonly internalPolicyRepository: InternalPolicyRepository,
    private readonly clock: Clock,
  ) {}

  createPolicy(policy: NewInternalPolicy): Promise<InternalPolicy> {
    return this.internalPolicyRepository.createPolicy(policy);
  }

  listPolicies(): Promise<InternalPolicy[]> {
    return this.internalPolicyRepository.listPolicies();
  }

  async getPolicy(policyId: string): Promise<InternalPolicy> {
    const policy = await this.internalPolicyRepository.findPolicy(policyId);

    if (!policy) {
      throw new NotFoundError("Internal policy", policyId);
    }

    return policy;
  }

  async createVersion(version: NewInternalPolicyVersion): Promise<InternalPolicyVersion> {
    await this.getPolicy(version.policyId);

    return this.internalPolicyRepository.createVersion(version);
  }

  async listVersions(policyId: string): Promise<InternalPolicyVersion[]> {
    await this.getPolicy(policyId);

    return this.internalPolicyRepository.listVersions(policyId);
  }

  async getVersion(policyId: string, versionId: string): Promise<InternalPolicyVersion> {
    const version = await this.internalPolicyRepository.findVersion(versionId);

    if (!version || version.policyId !== policyId) {
      throw new NotFoundError("Internal policy version", versionId);
    }

    return version;
  }

  async submitVersionForReview(policyId: string, versionId: string): Promise<InternalPolicyVersion> {
    const version = await this.getVersion(policyId, versionId);

    await this.internalPolicyRepository.updateVersionStatus(createReviewSubmission(version));

    return this.getVersion(policyId, versionId);
  }

  // A policy has no active-version pointer, so approving a version supersedes the previously approved ones.
  async reviewVersion(
    policyId: string,
    versionId: string,
    input: ReviewInput,
  ): Promise<InternalPolicyVersion> {
    const version = await this.getVersion(policyId, versionId);
    const review = createVersionReview(version, input, this.clock);
    const supersededVersionIds =
      review.decision === "approved" ? await this.findApprovedVersionIds(policyId, versionId) : [];

    await this.internalPolicyRepository.recordReview({ versionId, review, supersededVersionIds });

    return this.getVersion(policyId, versionId);
  }

  private async findApprovedVersionIds(policyId: string, exceptVersionId: string): Promise<string[]> {
    const versions = await this.internalPolicyRepository.listVersions(policyId);

    return versions
      .filter((version) => version.status === "approved" && version.id !== exceptVersionId)
      .map((version) => version.id);
  }
}
