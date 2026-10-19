export type CurrentUser = { id: string; name: string; role: string };

// No authentication in the MVP: a fixed analyst identity is recorded as the approver of rules and policies.
// `id` is the admin user seeded by the backend migration SeedAdminUser (M12); live calls send it as
// createdBy / reviewedBy.
export const CURRENT_USER: CurrentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Jana Nováková",
  role: "AML Analyst",
};

/** The backend returns user ids only; the current user is shown by name, any other user by id. */
export function formatUserName(userId: string): string {
  return userId === CURRENT_USER.id ? CURRENT_USER.name : userId;
}
