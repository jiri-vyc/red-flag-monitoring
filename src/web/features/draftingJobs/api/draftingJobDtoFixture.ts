import type { DraftingJobDto } from "./dto";

/** Test data: a pending policy job as `POST /drafting-jobs` answers it. */
export function createDraftingJobDto(overrides: Partial<DraftingJobDto> = {}): DraftingJobDto {
  return {
    id: "job-1",
    kind: "policy_from_regulation",
    status: "pending",
    parentJobId: null,
    sourceKind: "text",
    sourceUrl: null,
    scope: null,
    regulationId: "reg-1",
    regulationVersionId: "reg-version-1",
    policyVersionId: null,
    policyVersions: [],
    ruleVersions: [],
    errorMessage: null,
    warnings: [],
    versionLabel: null,
    attempts: 0,
    createdBy: "user-1",
    createdAt: "2026-10-19T10:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}
