import {
  canChangeVersionStatus,
  isReviewCommentRequired,
  type ReviewableVersion,
  type ReviewDecision,
  type VersionReview,
} from "../domain/versionStatus";
import type { Clock } from "./clock";
import { BusinessRuleViolationError, ConflictError } from "./errors";

export type ReviewInput = { decision: ReviewDecision; reviewedBy: string; reviewComment: string | null };

// Repositories apply status changes only when the row is still in `fromStatus`, so concurrent reviews conflict.
export type VersionStatusChange = {
  versionId: string;
  fromStatus: ReviewableVersion["status"];
  toStatus: ReviewableVersion["status"];
};

export function createReviewSubmission(version: ReviewableVersion): VersionStatusChange {
  return createStatusChange(version, "pending_review");
}

export function createVersionReview(
  version: ReviewableVersion,
  input: ReviewInput,
  clock: Clock,
): VersionReview {
  createStatusChange(version, input.decision);

  if (isReviewCommentRequired(input.decision) && !input.reviewComment) {
    throw new BusinessRuleViolationError(`A ${input.decision} review needs a comment`);
  }

  return {
    decision: input.decision,
    reviewedBy: input.reviewedBy,
    reviewedAt: clock(),
    reviewComment: input.reviewComment,
  };
}

function createStatusChange(
  version: ReviewableVersion,
  toStatus: ReviewableVersion["status"],
): VersionStatusChange {
  if (!canChangeVersionStatus(version.status, toStatus)) {
    throw new ConflictError(`Version ${version.id} is ${version.status} and cannot become ${toStatus}`);
  }

  return { versionId: version.id, fromStatus: version.status, toStatus };
}
