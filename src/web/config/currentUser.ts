export type CurrentUser = { name: string; role: string };

// No authentication in the MVP: a fixed analyst identity is recorded as the approver of rules and policies.
export const CURRENT_USER: CurrentUser = { name: "Jana Nováková", role: "AML Analyst" };
