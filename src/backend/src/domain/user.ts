// M12: the MVP has a single role and no 4-eyes check.
export const USER_ROLES = ["admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type User = { id: string; name: string; email: string; role: UserRole };

// Seeded by the SeedAdminUser migration. Without auth (M12) it is the default actor where the web sends none.
export const DEMO_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000001";
