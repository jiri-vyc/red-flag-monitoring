import { z } from "zod";

import { reviewableVersionDtoSchema } from "@/features/policies/api/dto";
import { requestJson } from "@/lib/httpClient";

// DTOs of /api/rules (src/backend/src/delivery/http/rulesRouter.ts and ruleDefinitionSchema.ts).

export const BACKEND_RISK_PROFILES = ["low", "medium", "high"] as const;
export type BackendRiskProfile = (typeof BACKEND_RISK_PROFILES)[number];

export const ruleDtoSchema = z.object({
  id: z.string(),
  policyId: z.string().nullable(),
  code: z.string(),
  alertType: z.string(),
  kind: z.enum(["deterministic", "agentic"]),
  isEnabled: z.boolean(),
  activeVersionId: z.string().nullable(),
  isWhitelistAllowed: z.boolean(),
  createdAt: z.string(),
});
export type RuleDto = z.infer<typeof ruleDtoSchema>;

const conditionOperandSchema = z.union([
  z.strictObject({ feature: z.string().min(1) }),
  z.strictObject({ expr: z.string().min(1) }),
  z.strictObject({ list: z.string().min(1) }),
  z.strictObject({ value: z.union([z.number(), z.string(), z.boolean()]) }),
]);

/** Mirrors the backend ruleDefinitionSchema, so an edited definition is rejected before it is sent. */
export const ruleDefinitionDtoSchema = z.object({
  match: z.enum(["any", "all"]),
  features: z.array(z.string().min(1)),
  conditions: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        left: conditionOperandSchema,
        op: z.enum([">", ">=", "<", "<=", "=", "!=", "in", "not_in"]),
        right: conditionOperandSchema,
      }),
    )
    .min(1),
});
export type RuleDefinitionDto = z.infer<typeof ruleDefinitionDtoSchema>;

export const ruleLegalBasisDtoSchema = z.object({ regulationVersionId: z.string(), ref: z.string() });
export type RuleLegalBasisDto = z.infer<typeof ruleLegalBasisDtoSchema>;

export const ruleVersionDtoSchema = reviewableVersionDtoSchema.extend({
  ruleId: z.string(),
  derivedFromPolicyVersionId: z.string().nullable(),
  // Responses are only displayed; requests are validated with ruleDefinitionDtoSchema.
  definition: z.record(z.string(), z.unknown()).nullable(),
  agentPrompt: z.string().nullable(),
  agentModelId: z.string().nullable(),
  humanText: z.string(),
  thresholdRationale: z.string().nullable(),
  baseScore: z.number().int().nullable(),
  sensitivity: z.number().int(),
  riskProfiles: z.array(z.enum(BACKEND_RISK_PROFILES)),
  legalBases: z.array(ruleLegalBasisDtoSchema),
});
export type RuleVersionDto = z.infer<typeof ruleVersionDtoSchema>;

/** Request body of POST /rules/:ruleId/versions. */
export type NewRuleVersionDto = {
  status: "draft" | "pending_review";
  createdVia: "wizard" | "manual" | "reg_update";
  createdBy: string;
  derivedFromPolicyVersionId: string | null;
  definition: RuleDefinitionDto | null;
  agentPrompt: string | null;
  agentModelId: string | null;
  humanText: string;
  thresholdRationale: string | null;
  baseScore: number | null;
  sensitivity: number;
  riskProfiles: BackendRiskProfile[];
  legalBases: RuleLegalBasisDto[];
};

export const whitelistEntryDtoSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  clientId: z.string(),
  reason: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
});
export type WhitelistEntryDto = z.infer<typeof whitelistEntryDtoSchema>;

export type RuleWithVersionsDto = {
  rule: RuleDto;
  /** Sorted by versionNo, oldest first. */
  versions: RuleVersionDto[];
};

export const rulePath = (ruleId: string) => `/rules/${encodeURIComponent(ruleId)}`;

export function fetchRuleDtos(): Promise<RuleDto[]> {
  return requestJson({ path: "/rules", schema: z.array(ruleDtoSchema) });
}

async function fetchRuleVersions(ruleId: string): Promise<RuleVersionDto[]> {
  const versions = await requestJson({
    path: `${rulePath(ruleId)}/versions`,
    schema: z.array(ruleVersionDtoSchema),
  });
  return versions.toSorted((left, right) => left.versionNo - right.versionNo);
}

export async function fetchRuleWithVersions(ruleId: string): Promise<RuleWithVersionsDto> {
  const [rule, versions] = await Promise.all([
    requestJson({ path: rulePath(ruleId), schema: ruleDtoSchema }),
    fetchRuleVersions(ruleId),
  ]);
  return { rule, versions };
}

export async function fetchRulesWithVersions(): Promise<RuleWithVersionsDto[]> {
  const rules = await fetchRuleDtos();
  return Promise.all(rules.map(async (rule) => ({ rule, versions: await fetchRuleVersions(rule.id) })));
}

/** M6: evaluations run the active version; without one the rule has nothing to run. */
export function findActiveVersionDto({ rule, versions }: RuleWithVersionsDto): RuleVersionDto | null {
  return versions.find((version) => version.id === rule.activeVersionId) ?? null;
}

/** The version whose legal basis and text describe the rule: the running one, else the newest. */
export function findDescribingVersionDto(ruleWithVersions: RuleWithVersionsDto): RuleVersionDto | null {
  return findActiveVersionDto(ruleWithVersions) ?? ruleWithVersions.versions.at(-1) ?? null;
}

export function formatRuleName(rule: Pick<RuleDto, "code" | "alertType">): string {
  return `${rule.code} · ${rule.alertType}`;
}
