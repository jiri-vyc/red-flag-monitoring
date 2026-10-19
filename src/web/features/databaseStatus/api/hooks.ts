"use client";

import { useQuery } from "@tanstack/react-query";

import { loadDatabaseStatus } from "./live";

// No mock implementation on purpose: the probe exists to show the backend's real database.
export function useDatabaseStatus() {
  return useQuery({ queryKey: ["database-status"], queryFn: loadDatabaseStatus });
}
