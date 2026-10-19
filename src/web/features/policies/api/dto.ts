import { z } from "zod";

import { requestJson } from "@/lib/httpClient";

// Response DTOs of /api/internal-policies (src/backend/src/delivery/http/internalPoliciesRouter.ts).

export const VERSION_STATUSES = ["draft", "pending_review", "approved", "rejected", "superseded"] as const;
export const versionStatusDtoSchema = z.enum(VERSION_STATUSES);
export type VersionStatusDto = z.infer<typeof versionStatusDtoSchema>;

export const VERSION_ORIGINS = ["wizard", "manual", "reg_update"] as const;
export const versionOriginDtoSchema = z.enum(VERSION_ORIGINS);
export type VersionOriginDto = z.infer<typeof versionOriginDtoSchema>;

/** Fields shared by policy and rule versions (backend ReviewableVersion). */
export const reviewableVersionDtoSchema = z.object({
  id: z.string(),
  versionNo: z.number().int(),
  status: versionStatusDtoSchema,
  createdVia: versionOriginDtoSchema,
  createdBy: z.string(),
  createdAt: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewComment: z.string().nullable(),
});

export const internalPolicyDtoSchema = z.object({ id: z.string(), code: z.string(), title: z.string() });
export type InternalPolicyDto = z.infer<typeof internalPolicyDtoSchema>;

export const policyLegalBasisDtoSchema = z.object({
  regulationVersionId: z.string(),
  ref: z.string().nullable(),
});
export type PolicyLegalBasisDto = z.infer<typeof policyLegalBasisDtoSchema>;

export const internalPolicyVersionDtoSchema = reviewableVersionDtoSchema.extend({
  policyId: z.string(),
  body: z.string(),
  legalBases: z.array(policyLegalBasisDtoSchema),
});
export type InternalPolicyVersionDto = z.infer<typeof internalPolicyVersionDtoSchema>;

export type InternalPolicyWithVersionsDto = {
  policy: InternalPolicyDto;
  /** Sorted by versionNo, oldest first. */
  versions: InternalPolicyVersionDto[];
};

export const internalPolicyPath = (policyId: string) => `/internal-policies/${encodeURIComponent(policyId)}`;

async function fetchPolicyVersions(policyId: string): Promise<InternalPolicyVersionDto[]> {
  const versions = await requestJson({
    path: `${internalPolicyPath(policyId)}/versions`,
    schema: z.array(internalPolicyVersionDtoSchema),
  });
  return versions.toSorted((left, right) => left.versionNo - right.versionNo);
}

export async function fetchPolicyWithVersions(policyId: string): Promise<InternalPolicyWithVersionsDto> {
  const [policy, versions] = await Promise.all([
    requestJson({ path: internalPolicyPath(policyId), schema: internalPolicyDtoSchema }),
    fetchPolicyVersions(policyId),
  ]);
  return { policy, versions };
}

export function fetchPolicyDtos(): Promise<InternalPolicyDto[]> {
  return requestJson({ path: "/internal-policies", schema: z.array(internalPolicyDtoSchema) });
}

export async function fetchPoliciesWithVersions(): Promise<InternalPolicyWithVersionsDto[]> {
  const policies = await fetchPolicyDtos();
  return Promise.all(
    policies.map(async (policy) => ({ policy, versions: await fetchPolicyVersions(policy.id) })),
  );
}
