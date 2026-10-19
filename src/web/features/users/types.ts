import { z } from "zod";

/** Issue #6: compliance roles; contact person (AML zákon § 22) and designated person (§ 22a) come from the law. */
export const USER_ROLES = [
  "compliance_analyst",
  "compliance_officer",
  "lawyer",
  "contact_person",
  "designated_person",
] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

/** A rule version escalates its hits to one role, the contact person unless the compliance officer picks another. */
export const DEFAULT_ESCALATION_ROLE: UserRole = "contact_person";

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roles: z.array(userRoleSchema).min(1),
});
export type User = z.infer<typeof userSchema>;
