import { recordAuditEvent } from "../audit/auditLog";
import type { DraftingJob } from "../../domain/draftingJob";
import type { InternalPolicy, InternalPolicyVersion } from "../../domain/internalPolicy";
import type { Clock } from "../clock";
import { newRulesFromPolicyJob } from "../drafting/draftingJobPorts";
import type { DraftingJobUseCases } from "../drafting/draftingJobUseCases";
import { NotFoundError } from "../errors";
import { createReviewSubmission, createVersionReview, type ReviewInput } from "../versionReview";
import type {
  InternalPolicyRepository,
  NewInternalPolicy,
  NewInternalPolicyVersion,
} from "./internalPolicyRepository";

export type RuleDrafting = Pick<DraftingJobUseCases, "findPolicyJobIdForPolicy" | "launchStoredJob">;

export type ReviewedPolicyVersion = InternalPolicyVersion & { rulesJob: DraftingJob | null };

export class InternalPolicyUseCases {
  constructor(
    private readonly internalPolicyRepository: InternalPolicyRepository,
    private readonly clock: Clock,
    private readonly ruleDrafting: RuleDrafting,
  ) {}

  async createPolicy(policy: NewInternalPolicy): Promise<InternalPolicy> {
    const created = await this.internalPolicyRepository.createPolicy(policy);

    recordAuditEvent({
      action: "internal_policy.created",
      entityType: "internal_policy",
      entityId: created.id,
      actorId: null,
      payload: { code: created.code },
    });

    return created;
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
    const created = await this.internalPolicyRepository.createVersion(version);

    recordAuditEvent({
      action: "internal_policy.version_created",
      entityType: "internal_policy",
      entityId: version.policyId,
      actorId: version.createdBy,
      payload: { versionId: created.id, versionNo: created.versionNo, createdVia: version.createdVia },
    });

    return created;
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
    recordAuditEvent({
      action: "internal_policy.version_submitted",
      entityType: "internal_policy",
      entityId: policyId,
      actorId: null,
      payload: { versionId },
    });

    return this.getVersion(policyId, versionId);
  }

  // A policy has no active-version pointer, so approving a version supersedes the previously approved ones.
  // Approval stores a rule drafting job together with the review (#2); the reviewer becomes the rules' author.
  async reviewVersion(
    policyId: string,
    versionId: string,
    input: ReviewInput,
  ): Promise<ReviewedPolicyVersion> {
    const version = await this.getVersion(policyId, versionId);
    const review = createVersionReview(version, input, this.clock);
    const isApproved = review.decision === "approved";
    const supersededVersionIds = isApproved ? await this.findApprovedVersionIds(policyId, versionId) : [];
    const rulesJob = isApproved
      ? newRulesFromPolicyJob({
          policyVersionId: versionId,
          parentJobId: await this.ruleDrafting.findPolicyJobIdForPolicy(policyId),
          createdBy: review.reviewedBy,
        })
      : null;
    const rulesJobId = await this.internalPolicyRepository.recordReview({
      versionId,
      review,
      supersededVersionIds,
      rulesJob,
    });
    recordAuditEvent({
      action: "internal_policy.version_reviewed",
      entityType: "internal_policy",
      entityId: policyId,
      actorId: input.reviewedBy,
      payload: {
        versionId,
        decision: input.decision,
        reviewComment: input.reviewComment,
        supersededVersionIds,
        rulesJobId,
      },
    });
    const reviewedVersion = await this.getVersion(policyId, versionId);

    return {
      ...reviewedVersion,
      rulesJob: rulesJobId ? await this.ruleDrafting.launchStoredJob(rulesJobId) : null,
    };
  }

  private async findApprovedVersionIds(policyId: string, exceptVersionId: string): Promise<string[]> {
    const versions = await this.internalPolicyRepository.listVersions(policyId);

    return versions
      .filter((version) => version.status === "approved" && version.id !== exceptVersionId)
      .map((version) => version.id);
  }
}
