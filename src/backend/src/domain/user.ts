// Issue #6: compliance roles; contact person (AML zákon § 22) and designated person (§ 22a) come from the law.
// A user can hold several roles. Without auth (M12) the web picks the active role and the backend trusts it.
export const USER_ROLES = [
  "compliance_analyst",
  "compliance_officer",
  "lawyer",
  "contact_person",
  "designated_person",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type User = { id: string; name: string; email: string; roles: UserRole[] };

// Seeded by the SeedAdminUser migration. Without auth (M12) it is the default actor where the web sends none.
export const DEMO_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000001";
