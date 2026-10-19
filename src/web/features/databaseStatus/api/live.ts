import { requestJson } from "@/lib/httpClient";

import { databaseStatusSchema, type DatabaseStatus } from "../types";

export function loadDatabaseStatus(): Promise<DatabaseStatus> {
  return requestJson({ path: "/database-status", schema: databaseStatusSchema });
}
