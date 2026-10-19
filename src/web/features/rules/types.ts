import { z } from "zod";

import { ruleLegalBasisSchema, type RuleLegalBasis } from "@/features/regulations/types";

export const RULE_STATUSES = [
  "draft",
  "pending_for_review",
  "update_for_review",
  "active",
  "inactive",
] as const;
export const ruleStatusSchema = z.enum(RULE_STATUSES);
export type RuleStatus = z.infer<typeof ruleStatusSchema>;

export const ruleTypeSchema = z.enum(["deterministic", "agentic"]);
export type RuleType = z.infer<typeof ruleTypeSchema>;

export const RISK_PROFILES = ["high", "medium", "low", "unknown"] as const;
export const riskProfileSchema = z.enum(RISK_PROFILES);
export type RiskProfile = z.infer<typeof riskProfileSchema>;

export const ruleContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("deterministic"), code: z.string(), explanation: z.string() }),
  z.object({ type: z.literal("agentic"), ruleText: z.string() }),
]);
export type RuleContent = z.infer<typeof ruleContentSchema>;

/** Detection config travels with each version, so any change to it goes through review like a content change (M7). */
export const ruleConfigSchema = z.object({
  sensitivity: z.number().int().min(0).max(100),
  riskProfiles: z.array(riskProfileSchema),
});
export type RuleConfig = z.infer<typeof ruleConfigSchema>;
export const RULE_CONFIG_FIELDS = ["sensitivity", "riskProfiles"] as const;
export type RuleConfigField = (typeof RULE_CONFIG_FIELDS)[number];

export const ruleVersionStateSchema = z.enum([
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "superseded",
]);
export type RuleVersionState = z.infer<typeof ruleVersionStateSchema>;

export const ruleVersionSchema = z.object({
  versionNumber: z.number().int().positive(),
  state: ruleVersionStateSchema,
  content: ruleContentSchema,
  config: ruleConfigSchema,
  changeNote: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  /** M5: each version has its own legal basis; it is not inherited from the policy. */
  legalBases: z.array(ruleLegalBasisSchema),
});
export type RuleVersion = z.infer<typeof ruleVersionSchema>;

export const ruleOriginSchema = z.enum(["wizard", "manual"]);
export type RuleOrigin = z.infer<typeof ruleOriginSchema>;

export const ruleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: ruleTypeSchema,
  status: ruleStatusSchema,
  origin: ruleOriginSchema,
  /** M4: a rule may stand without an internal policy. */
  policyId: z.string().nullable(),
  /** The approved version (content + config) that evaluations run. Null until a version is approved. */
  runningVersionNumber: z.number().int().positive().nullable(),
  versions: z.array(ruleVersionSchema),
  /** False for regulatory-mandatory rules: no client may be exempted (M16). */
  whitelistAllowed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Rule = z.infer<typeof ruleSchema>;

/** A rule × client exception (M16). Lives at rule level, so changes apply immediately without a new version. */
export const whitelistEntrySchema = z.object({
  ruleId: z.string(),
  clientId: z.string(),
  reason: z.string().min(1),
  createdBy: z.string(),
  createdAt: z.string(),
});
export type WhitelistEntry = z.infer<typeof whitelistEntrySchema>;

/** The config fields become the config of version 1. */
export type CreateManualRuleInput = RuleConfig & {
  description: string;
  policyId: string | null;
  type: RuleType;
  /** The legal basis of version 1 (M5); the backend needs at least one with a provision ref. */
  legalBases: RuleLegalBasis[];
};

export type CreateRuleVersionInput = {
  ruleId: string;
  content: RuleContent;
  config: RuleConfig;
  changeNote: string;
};
export type UpdateDraftContentInput = { ruleId: string; content: RuleContent };

export type AddWhitelistEntryInput = { ruleId: string; clientId: string; reason: string };
export type RemoveWhitelistEntryInput = { ruleId: string; clientId: string };
