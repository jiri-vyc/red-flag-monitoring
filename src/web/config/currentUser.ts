import type { User, UserRole } from "@/features/users/types";

/** The user the web acts as, plus the one role it currently acts in (issue #6: a user can hold several roles). */
export type CurrentUser = User & { activeRole: UserRole };

// No authentication in the MVP: the sidebar picks the user and role, and live calls send the user's id as
// createdBy / reviewedBy. The demo admin is seeded by the backend migration SeedAdminUser and holds every role.
export const DEMO_ADMIN_USER: User = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Demo Admin",
  email: "admin@example.com",
  roles: ["compliance_analyst", "compliance_officer", "lawyer", "contact_person", "designated_person"],
};

const DEFAULT_CURRENT_USER: CurrentUser = { ...DEMO_ADMIN_USER, activeRole: "compliance_officer" };
const CURRENT_USER_STORAGE_KEY = "redflag.currentUser";

let selectedUser: CurrentUser | undefined;
const currentUserListeners = new Set<() => void>();
const userNamesById = new Map<string, string>([[DEMO_ADMIN_USER.id, DEMO_ADMIN_USER.name]]);

function isCurrentUser(value: unknown): value is CurrentUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<CurrentUser>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    Array.isArray(candidate.roles) &&
    typeof candidate.activeRole === "string" &&
    candidate.roles.includes(candidate.activeRole)
  );
}

function readStoredUser(): CurrentUser | undefined {
  try {
    const storedValue: unknown = JSON.parse(window.localStorage.getItem(CURRENT_USER_STORAGE_KEY) ?? "null");
    return isCurrentUser(storedValue) ? storedValue : undefined;
  } catch {
    return undefined;
  }
}

function storeUser(user: CurrentUser): void {
  try {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Blocked storage only means the choice is not remembered after a reload.
  }
}

function selectUser(user: CurrentUser): void {
  selectedUser = user;
  userNamesById.set(user.id, user.name);
  storeUser(user);
  currentUserListeners.forEach((notifyListener) => notifyListener());
}

/** The server and the hydration render always use the demo admin, so they never mismatch. */
export function getDefaultCurrentUser(): CurrentUser {
  return DEFAULT_CURRENT_USER;
}

export function getCurrentUser(): CurrentUser {
  if (typeof window === "undefined") {
    return DEFAULT_CURRENT_USER;
  }
  selectedUser ??= readStoredUser() ?? DEFAULT_CURRENT_USER;
  return selectedUser;
}

/** Switches the user; keeps the active role when the new user holds it, else takes the user's first role. */
export function setCurrentUser(user: User): void {
  const { activeRole } = getCurrentUser();
  const nextActiveRole = user.roles.includes(activeRole) ? activeRole : user.roles[0];
  if (nextActiveRole === undefined) {
    return;
  }
  selectUser({ ...user, activeRole: nextActiveRole });
}

export function setActiveRole(role: UserRole): void {
  const currentUser = getCurrentUser();
  if (role === currentUser.activeRole || !currentUser.roles.includes(role)) {
    return;
  }
  selectUser({ ...currentUser, activeRole: role });
}

export function subscribeToCurrentUser(listener: () => void): () => void {
  currentUserListeners.add(listener);
  return () => currentUserListeners.delete(listener);
}

/** Makes names of loaded users known to formatUserName. */
export function rememberUserNames(users: readonly User[]): void {
  users.forEach((user) => userNamesById.set(user.id, user.name));
}

/** The backend returns user ids only; known users are shown by name, any other user by id. */
export function formatUserName(userId: string): string {
  return userNamesById.get(userId) ?? userId;
}

/** Test helper: forgets the in-memory choice so the next read starts from localStorage again. */
export function forgetCurrentUserForTests(): void {
  selectedUser = undefined;
}
