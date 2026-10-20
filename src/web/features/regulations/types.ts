import { z } from "zod";

export const jurisdictionSchema = z.enum(["CZ", "EU", "INTL"]);
export type Jurisdiction = z.infer<typeof jurisdictionSchema>;

export const regulationSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  jurisdiction: jurisdictionSchema,
  description: z.string(),
  /**
   * An http(s) URL, or empty when the regulation has none. Not validated here: both adapters pass it through
   * `toSafeSourceUrl` (lib/url.ts) before it reaches the UI.
   */
  sourceUrl: z.string(),
  version: z.string(),
  lastCheckedAt: z.string(),
  keyProvisions: z.array(z.string()),
  policyIds: z.array(z.string()),
  ruleIds: z.array(z.string()),
});
export type Regulation = z.infer<typeof regulationSchema>;

/** M3: a policy cites a regulation optionally with a provision `ref` (M2: provisions are free text). */
export const policyLegalBasisSchema = z.object({ regulationId: z.string(), ref: z.string().nullable() });
export type PolicyLegalBasis = z.infer<typeof policyLegalBasisSchema>;

/** M5: a rule version always names the provision it stands on, e.g. "§ 6 odst. 1 písm. b)". */
export const ruleLegalBasisSchema = z.object({ regulationId: z.string(), ref: z.string().min(1) });
export type RuleLegalBasis = z.infer<typeof ruleLegalBasisSchema>;

/** Policy and rule legal bases share this shape; a rule's ref is never null. */
export type LegalBasis = PolicyLegalBasis;

export function formatLegalBasisRefs(legalBases: LegalBasis[]): string {
  return legalBases
    .map((legalBasis) => legalBasis.ref)
    .filter((ref) => ref !== null)
    .join("; ");
}
