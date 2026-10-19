import { z } from "zod";

import { reviewableVersionDtoSchema } from "@/features/policies/api/dto";
import { userRoleSchema, type UserRole } from "@/features/users/types";
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

const conditionLogicSchema = z.enum(["any", "all"]);

const ruleConditionDtoSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  left: conditionOperandSchema,
  op: z.enum([">", ">=", "<", "<=", "=", "!=", "in", "not_in"]),
  right: conditionOperandSchema,
});
export type RuleConditionDto = z.infer<typeof ruleConditionDtoSchema>;

/** A group nests conditions under its own `match`, e.g. `all` inside a top-level `any`. */
export type RuleConditionGroupDto = {
  id: string;
  label: string;
  match: z.infer<typeof conditionLogicSchema>;
  conditions: RuleConditionNodeDto[];
};
export type RuleConditionNodeDto = RuleConditionDto | RuleConditionGroupDto;

const ruleConditionGroupDtoSchema: z.ZodType<RuleConditionGroupDto> = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  match: conditionLogicSchema,
  // A getter defers the recursive reference until the node schema below exists.
  get conditions() {
    return z.array(ruleConditionNodeDtoSchema).min(1);
  },
});

// A condition has no `match`, a group has no `left`/`op`/`right`, so the union is unambiguous.
const ruleConditionNodeDtoSchema: z.ZodType<RuleConditionNodeDto> = z.union([
  ruleConditionDtoSchema,
  ruleConditionGroupDtoSchema,
]);

export function isConditionGroupDto(node: RuleConditionNodeDto): node is RuleConditionGroupDto {
  return "match" in node;
}

/** Every condition and group of the tree, depth first. */
export function listConditionNodeDtos(nodes: RuleConditionNodeDto[]): RuleConditionNodeDto[] {
  return nodes.flatMap((node) =>
    isConditionGroupDto(node) ? [node, ...listConditionNodeDtos(node.conditions)] : [node],
  );
}

function hasUniqueNodeIds(nodes: RuleConditionNodeDto[]): boolean {
  const nodeIds = listConditionNodeDtos(nodes).map((node) => node.id);
  return new Set(nodeIds).size === nodeIds.length;
}

/** Mirrors the backend ruleDefinitionSchema, so an edited definition is rejected before it is sent. */
export const ruleDefinitionDtoSchema = z.object({
  match: conditionLogicSchema,
  features: z.array(z.string().min(1)),
  conditions: z
    .array(ruleConditionNodeDtoSchema)
    .min(1)
    .refine(hasUniqueNodeIds, { message: "Condition ids must be unique across nested groups" }),
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
  escalationRole: userRoleSchema,
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
  escalationRole: UserRole;
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

function attachRuleVersions(rules: RuleDto[]): Promise<RuleWithVersionsDto[]> {
  return Promise.all(rules.map(async (rule) => ({ rule, versions: await fetchRuleVersions(rule.id) })));
}

export async function fetchRulesWithVersions(): Promise<RuleWithVersionsDto[]> {
  return attachRuleVersions(await fetchRuleDtos());
}

/** GET /rules has no filter, so the rules of one policy are picked on the web (BE-12). */
export async function fetchPolicyRulesWithVersions(policyId: string): Promise<RuleWithVersionsDto[]> {
  const rules = await fetchRuleDtos();
  return attachRuleVersions(rules.filter((rule) => rule.policyId === policyId));
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
