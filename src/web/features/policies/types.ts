import { z } from "zod";

import type { DraftingJob } from "@/features/draftingJobs/types";
import { policyLegalBasisSchema } from "@/features/regulations/types";

import { findCurrentVersion } from "./domain/currentVersion";

export const policyStatusSchema = z.enum(["draft", "approved"]);
export type PolicyStatus = z.infer<typeof policyStatusSchema>;

export const policyOriginSchema = z.enum(["generated", "manual"]);
export type PolicyOrigin = z.infer<typeof policyOriginSchema>;

/** Mirrors the backend version statuses; approving a version supersedes the previously approved one. */
export const policyVersionStateSchema = z.enum([
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "superseded",
]);
export type PolicyVersionState = z.infer<typeof policyVersionStateSchema>;

export const policyVersionOriginSchema = z.enum(["wizard", "manual", "reg_update"]);
export type PolicyVersionOrigin = z.infer<typeof policyVersionOriginSchema>;

/** One immutable wording of the policy (M17) with its own legal bases and review. */
export const policyVersionSchema = z.object({
  versionNumber: z.number().int().positive(),
  state: policyVersionStateSchema,
  createdVia: policyVersionOriginSchema,
  text: z.string(),
  legalBases: z.array(policyLegalBasisSchema),
  /** Display name of the author. */
  createdBy: z.string(),
  createdAt: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewComment: z.string().nullable(),
});
export type PolicyVersion = z.infer<typeof policyVersionSchema>;

export const policySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Legal bases of the current version (M3, see `findCurrentPolicyVersion`). Empty for a purely internal policy. */
  legalBases: z.array(policyLegalBasisSchema),
  status: policyStatusSchema,
  origin: policyOriginSchema,
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  ruleIds: z.array(z.string()),
  /** Oldest first. Status, text and legal bases come from the current version (`findCurrentPolicyVersion`). */
  versions: z.array(policyVersionSchema),
});
export type Policy = z.infer<typeof policySchema>;

/** The version the policy's status, text and legal bases come from (see `findCurrentVersion`). */
export function findCurrentPolicyVersion(policy: Pick<Policy, "versions">): PolicyVersion | undefined {
  return findCurrentVersion(policy.versions, (version) => version.state);
}

export type UpdatePolicyTextInput = { policyId: string; text: string };

/** Approving a policy version starts a job that drafts its rules (`draft`, awaiting their own review), if any. */
export type PolicyApproval = { policy: Policy; rulesJob: DraftingJob | null };
