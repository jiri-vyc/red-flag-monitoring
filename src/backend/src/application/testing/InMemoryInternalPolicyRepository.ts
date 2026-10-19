import type { InternalPolicy, InternalPolicyVersion } from "../../domain/internalPolicy";
import { ConflictError } from "../errors";
import type {
  InternalPolicyRepository,
  NewInternalPolicy,
  NewInternalPolicyVersion,
  PolicyVersionReviewRecord,
} from "../internalPolicies/internalPolicyRepository";
import type { VersionStatusChange } from "../versionReview";

export class InMemoryInternalPolicyRepository implements InternalPolicyRepository {
  readonly policies = new Map<string, InternalPolicy>();
  readonly versions = new Map<string, InternalPolicyVersion>();
  private nextId = 1;

  async createPolicy(policy: NewInternalPolicy): Promise<InternalPolicy> {
    const created = { ...policy, id: `policy-${this.nextId++}` };
    this.policies.set(created.id, created);

    return created;
  }

  async listPolicies(): Promise<InternalPolicy[]> {
    return [...this.policies.values()];
  }

  async findPolicy(policyId: string): Promise<InternalPolicy | null> {
    return this.policies.get(policyId) ?? null;
  }

  async createVersion(version: NewInternalPolicyVersion): Promise<InternalPolicyVersion> {
    const versionNo = (await this.listVersions(version.policyId)).length + 1;
    const created: InternalPolicyVersion = {
      ...version,
      id: `policy-version-${this.nextId++}`,
      versionNo,
      createdAt: new Date(0),
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
    };
    this.versions.set(created.id, created);

    return created;
  }

  async listVersions(policyId: string): Promise<InternalPolicyVersion[]> {
    return [...this.versions.values()].filter((version) => version.policyId === policyId);
  }

  async findVersion(versionId: string): Promise<InternalPolicyVersion | null> {
    return this.versions.get(versionId) ?? null;
  }

  async updateVersionStatus(change: VersionStatusChange): Promise<void> {
    const version = this.getVersionInStatus(change.versionId, change.fromStatus);

    this.versions.set(version.id, { ...version, status: change.toStatus });
  }

  async recordReview(record: PolicyVersionReviewRecord): Promise<void> {
    const version = this.getVersionInStatus(record.versionId, "pending_review");
    const { review } = record;

    this.versions.set(version.id, {
      ...version,
      status: review.decision,
      reviewedBy: review.reviewedBy,
      reviewedAt: review.reviewedAt,
      reviewComment: review.reviewComment,
    });

    for (const supersededId of record.supersededVersionIds) {
      const superseded = this.versions.get(supersededId);

      if (superseded?.status === "approved") {
        this.versions.set(supersededId, { ...superseded, status: "superseded" });
      }
    }
  }

  private getVersionInStatus(
    versionId: string,
    status: InternalPolicyVersion["status"],
  ): InternalPolicyVersion {
    const version = this.versions.get(versionId);

    if (!version || version.status !== status) {
      throw new ConflictError(`Version ${versionId} changed`);
    }

    return version;
  }
}
