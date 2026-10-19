import { type EntityManager, In } from "typeorm";

import type { VersionReview } from "../../../domain/versionStatus";
import { ConflictError } from "../../../application/errors";
import type { VersionStatusChange } from "../../../application/versionReview";
import { InternalPolicyVersionEntity } from "../entities/InternalPolicyVersionEntity";
import { RuleVersionEntity } from "../entities/RuleVersionEntity";

type ReviewableVersionEntity = typeof InternalPolicyVersionEntity | typeof RuleVersionEntity;

// Conditional on the current status, so a concurrent change makes this a ConflictError instead of a lost update.
export async function updateVersionStatus(
  manager: EntityManager,
  versionEntity: ReviewableVersionEntity,
  change: VersionStatusChange,
): Promise<void> {
  const result = await manager.update(
    versionEntity,
    { id: change.versionId, status: change.fromStatus },
    { status: change.toStatus },
  );

  assertVersionUpdated(result.affected, change.versionId);
}

export async function recordVersionReview(
  manager: EntityManager,
  versionEntity: ReviewableVersionEntity,
  versionId: string,
  review: VersionReview,
): Promise<void> {
  const result = await manager.update(
    versionEntity,
    { id: versionId, status: "pending_review" },
    {
      status: review.decision,
      reviewedBy: review.reviewedBy,
      reviewedAt: review.reviewedAt,
      reviewComment: review.reviewComment,
    },
  );

  assertVersionUpdated(result.affected, versionId);
}

export async function supersedeApprovedVersions(
  manager: EntityManager,
  versionEntity: ReviewableVersionEntity,
  versionIds: string[],
): Promise<void> {
  if (versionIds.length === 0) {
    return;
  }

  await manager.update(versionEntity, { id: In(versionIds), status: "approved" }, { status: "superseded" });
}

// version_no is max + 1 per parent; two concurrent creates hit the unique key and one gets a ConflictError.
export function toNextVersionNo(maxVersionNo: number | null): number {
  return (maxVersionNo ?? 0) + 1;
}

function assertVersionUpdated(affected: number | null | undefined, versionId: string): void {
  if (affected === 0) {
    throw new ConflictError(`Version ${versionId} changed in the meantime, reload it and try again`);
  }
}
