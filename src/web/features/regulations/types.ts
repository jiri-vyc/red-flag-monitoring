import { z } from "zod";

export const jurisdictionSchema = z.enum(["CZ", "EU", "INTL"]);
export type Jurisdiction = z.infer<typeof jurisdictionSchema>;

export const regulationSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  jurisdiction: jurisdictionSchema,
  description: z.string(),
  sourceUrl: z.string(),
  version: z.string(),
  lastCheckedAt: z.string(),
  keyProvisions: z.array(z.string()),
  policyIds: z.array(z.string()),
  ruleIds: z.array(z.string()),
});
export type Regulation = z.infer<typeof regulationSchema>;
