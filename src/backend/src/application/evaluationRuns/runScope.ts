import { createHash } from "node:crypto";

import type { RunScope } from "../../domain/evaluation";

export const UNLIMITED_RUN_SCOPE: RunScope = { from: null, to: null, clientIds: null, limit: null };

// The run has no uploaded file, so file_name describes the scope, e.g. "database: from 2026-07-01, 3 clients".
export function describeRunScope(scope: RunScope): string {
  const parts = [
    scope.from ? `from ${scope.from}` : null,
    scope.to ? `to ${scope.to}` : null,
    scope.clientIds ? `${scope.clientIds.length} clients` : null,
    scope.limit ? `first ${scope.limit}` : null,
  ].filter((part): part is string => part !== null);

  return `database: ${parts.length > 0 ? parts.join(", ") : "all transactions"}`;
}

// V3 stores the SHA-256 of the evaluated file; here it is the hash of the ordered evaluated transaction IDs.
// The worker recomputes it to detect transactions that changed between the start and the execution.
export function calculateTransactionSetDigest(transactionIds: readonly string[]): string {
  return createHash("sha256").update(transactionIds.join("\n")).digest("hex");
}
