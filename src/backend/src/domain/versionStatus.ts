export const VERSION_STATUSES = ["draft", "pending_review", "approved", "rejected", "superseded"] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const INITIAL_VERSION_STATUSES = [
  "draft",
  "pending_review",
] as const satisfies readonly VersionStatus[];
export type InitialVersionStatus = (typeof INITIAL_VERSION_STATUSES)[number];

export const REVIEW_DECISIONS = ["approved", "rejected"] as const satisfies readonly VersionStatus[];
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REVIEWED_VERSION_STATUSES = [
  "approved",
  "rejected",
  "superseded",
] as const satisfies readonly VersionStatus[];

export const VERSION_ORIGINS = ["wizard", "manual", "reg_update"] as const;
export type VersionOrigin = (typeof VERSION_ORIGINS)[number];

const NEXT_VERSION_STATUSES: Record<VersionStatus, readonly VersionStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["approved", "rejected"],
  approved: ["superseded"],
  rejected: [],
  superseded: [],
};

// Shared by internal policy and rule versions (M11, M17): content is immutable, only status and review change.
export type ReviewableVersion = {
  id: string;
  versionNo: number;
  status: VersionStatus;
  createdVia: VersionOrigin;
  createdBy: string;
  createdAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
};

export type VersionReview = {
  decision: ReviewDecision;
  reviewedBy: string;
  reviewedAt: Date;
  reviewComment: string | null;
};

export function canChangeVersionStatus(from: VersionStatus, to: VersionStatus): boolean {
  return NEXT_VERSION_STATUSES[from].includes(to);
}

// A rejection without a reason cannot be acted on by the author of the version.
export function isReviewCommentRequired(decision: ReviewDecision): boolean {
  return decision === "rejected";
}
