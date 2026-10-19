import { z } from "zod";

import { DRAFTING_JOB_KINDS, DRAFTING_JOB_STATUSES, DRAFTING_SOURCE_KINDS, type DraftingJob } from "../types";

// Response DTOs of /api/drafting-jobs (spec/drafting-jobs.md).

export const draftingJobDtoSchema = z.object({
  id: z.string(),
  kind: z.enum(DRAFTING_JOB_KINDS),
  status: z.enum(DRAFTING_JOB_STATUSES),
  parentJobId: z.string().nullable(),
  sourceKind: z.enum(DRAFTING_SOURCE_KINDS).nullable(),
  sourceUrl: z.string().nullable(),
  scope: z.string().nullable(),
  regulationId: z.string().nullable(),
  regulationVersionId: z.string().nullable(),
  policyVersionId: z.string().nullable(),
  policyVersions: z.array(z.object({ id: z.string(), policyId: z.string(), status: z.string() })),
  ruleVersions: z.array(z.object({ id: z.string(), ruleId: z.string(), status: z.string() })),
  errorMessage: z.string().nullable(),
  warnings: z.array(z.string()),
  versionLabel: z.string().nullable(),
  attempts: z.number().int(),
  createdBy: z.string(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});
export type DraftingJobDto = z.infer<typeof draftingJobDtoSchema>;

export const draftingJobPageDtoSchema = z.object({
  items: z.array(draftingJobDtoSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export const draftingJobPath = (jobId: string) => `/drafting-jobs/${encodeURIComponent(jobId)}`;

const unique = (ids: string[]) => [...new Set(ids)];

export function toDraftingJob(dto: DraftingJobDto): DraftingJob {
  return {
    id: dto.id,
    kind: dto.kind,
    status: dto.status,
    parentJobId: dto.parentJobId,
    sourceKind: dto.sourceKind,
    sourceUrl: dto.sourceUrl,
    regulationId: dto.regulationId,
    policyIds: unique(dto.policyVersions.map((version) => version.policyId)),
    ruleIds: unique(dto.ruleVersions.map((version) => version.ruleId)),
    errorMessage: dto.errorMessage,
    warnings: dto.warnings,
    attempts: dto.attempts,
    createdAt: dto.createdAt,
    startedAt: dto.startedAt,
    finishedAt: dto.finishedAt,
  };
}
