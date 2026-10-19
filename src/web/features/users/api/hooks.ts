"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import {
  getCurrentUser,
  getDefaultCurrentUser,
  rememberUserNames,
  subscribeToCurrentUser,
  type CurrentUser,
} from "@/config/currentUser";
import { useServiceUsage } from "@/providers/MockUsageProvider";

import { getRolePermissions, type RolePermissions } from "../permissions";
import { usersService } from "./service";

export function useUsers() {
  useServiceUsage("users");
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const users = await usersService.loadUsers();
      rememberUserNames(users);
      return users;
    },
  });
}

/** The user and active role picked in the sidebar; the server render uses the demo admin. */
export function useCurrentUser(): CurrentUser {
  return useSyncExternalStore(subscribeToCurrentUser, getCurrentUser, getDefaultCurrentUser);
}

export function useRolePermissions(): RolePermissions {
  return getRolePermissions(useCurrentUser().activeRole);
}
