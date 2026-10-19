import { z } from "zod";

import type { DraftingJob } from "@/features/draftingJobs/types";
import { policyLegalBasisSchema } from "@/features/regulations/types";

export const policyStatusSchema = z.enum(["draft", "approved"]);
export type PolicyStatus = z.infer<typeof policyStatusSchema>;

export const policyOriginSchema = z.enum(["generated", "manual"]);
export type PolicyOrigin = z.infer<typeof policyOriginSchema>;

export const policySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Legal bases of the latest version (M3). Empty for a purely internal policy. */
  legalBases: z.array(policyLegalBasisSchema),
  status: policyStatusSchema,
  origin: policyOriginSchema,
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  ruleIds: z.array(z.string()),
});
export type Policy = z.infer<typeof policySchema>;

export type UpdatePolicyTextInput = { policyId: string; text: string };

/** Approving a policy version starts a job that drafts its rules (`draft`, awaiting their own review), if any. */
export type PolicyApproval = { policy: Policy; rulesJob: DraftingJob | null };
