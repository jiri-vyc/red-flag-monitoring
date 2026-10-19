"use client";

import { UserRound } from "lucide-react";
import { useId } from "react";

import { fieldStyles } from "@/components/ui/Field";
import { setActiveRole, setCurrentUser } from "@/config/currentUser";
import { useI18n } from "@/i18n/I18nProvider";

import { useCurrentUser, useUsers } from "../api/hooks";
import type { UserRole } from "../types";
import styles from "./CurrentUserPicker.module.css";

/**
 * Issue #6: without sign-in, the sidebar picks who the web acts as and in which of the user's roles.
 * The choice is kept in the browser; actions and filtered results follow the active role.
 */
export function CurrentUserPicker() {
  const { t } = useI18n();
  const currentUser = useCurrentUser();
  const usersQuery = useUsers();
  const userSelectId = useId();
  const roleSelectId = useId();
  const users = usersQuery.data ?? [currentUser];

  const selectUser = (userId: string) => {
    const user = users.find((candidate) => candidate.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  return (
    <div className={styles.picker}>
      <span className={styles.avatar} aria-hidden="true">
        <UserRound />
      </span>
      <div className={styles.fields}>
        <label htmlFor={userSelectId} className={styles.label}>
          {t.sidebar.currentUser}
        </label>
        <select
          id={userSelectId}
          className={fieldStyles.select}
          value={currentUser.id}
          onChange={(event) => selectUser(event.target.value)}
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <label htmlFor={roleSelectId} className={styles.label}>
          {t.sidebar.activeRole}
        </label>
        <select
          id={roleSelectId}
          className={fieldStyles.select}
          value={currentUser.activeRole}
          onChange={(event) => setActiveRole(event.target.value as UserRole)}
        >
          {currentUser.roles.map((role) => (
            <option key={role} value={role}>
              {t.roles[role]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
