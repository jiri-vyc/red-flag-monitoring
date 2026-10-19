// M12: the MVP has a single role and no 4-eyes check.
export const USER_ROLES = ["admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type User = { id: string; name: string; email: string; role: UserRole };
