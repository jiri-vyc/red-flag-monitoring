import { z } from "zod";

import type { Batch, BatchTransaction, Transaction } from "@/features/batches/types";
import type { DraftingJob } from "@/features/draftingJobs/types";
import { policySchema, type Policy } from "@/features/policies/types";
import { regulationSchema, type Regulation } from "@/features/regulations/types";
import { ruleSchema, whitelistEntrySchema, type Rule, type WhitelistEntry } from "@/features/rules/types";
import { ApiError } from "@/lib/apiError";

import type { MockRuleSnapshot } from "../evaluation/evaluateTransaction";
import type { MockCheckKind } from "../evaluation/ruleChecks";
import { buildSeedDatabase } from "../seed/buildSeedDatabase";

/** Relations (policyIds, ruleIds) are derived from foreign keys when mapping to the domain model. */
export type MockRegulationRecord = Omit<Regulation, "policyIds" | "ruleIds">;
export type MockPolicyRecord = Omit<Policy, "ruleIds">;

export type MockBatchRecord = {
  batch: Omit<Batch, "status" | "processedRowCount" | "counts" | "finishedAt" | "isFullDatasetRun">;
  /** Simulated processing window. Progress is derived from wall-clock time so it survives navigation. */
  startedAtMs: number;
  durationMs: number;
  ruleSnapshots: MockRuleSnapshot[];
};

export type MockDraftingJobInput =
  { kind: "policy_from_regulation"; sourceLabel: string } | { kind: "rules_from_policy"; policyId: string };

export type MockDraftingJobRecord = {
  /** As of the last read; the simulated worker advances it from wall-clock time, so it survives a reload. */
  job: DraftingJob;
  createdAtMs: number;
  input: MockDraftingJobInput;
};

export type MockDatabase = {
  regulations: MockRegulationRecord[];
  policies: MockPolicyRecord[];
  rules: Rule[];
  ruleCheckKinds: Record<string, MockCheckKind>;
  /** Rule-level exceptions (M16), not versioned. Batches keep their own copy in ruleSnapshots. */
  whitelistEntries: WhitelistEntry[];
  batches: MockBatchRecord[];
  draftingJobs: MockDraftingJobRecord[];
};

/** The mock engine re-evaluates stored rows, so it keeps the full transaction with its CZK amount. */
export type MockBatchRow = BatchTransaction & { transaction: Transaction };

export type MockSeed = { database: MockDatabase; batchRows: Record<string, MockBatchRow[]> };

const MOCK_KEY_PREFIX = "redflag.mock.";
// v2: sensitivity, risk profiles and whitelist moved from the rule into each rule version.
// v3: whitelist moved out of rule versions into rule-level entries with a reason (data model M16).
// v4: policies cite 0..N regulations, rule versions carry their own legal bases, a rule's policy is optional (M3-M5).
// v5: rule versions carry a nullable base score.
// v6: policies carry their version history.
const DATABASE_KEY = `${MOCK_KEY_PREFIX}database.v6`;
const BATCH_ROWS_KEY_PREFIX = `${MOCK_KEY_PREFIX}batch-rows.v1.`;

let cachedDatabase: MockDatabase | null = null;
const cachedBatchRows = new Map<string, MockBatchRow[]>();

function getStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("Mock services run in the browser only (they persist to localStorage).");
  }
  return window.localStorage;
}

function writeStorageItem(key: string, value: unknown): void {
  try {
    getStorage().setItem(key, JSON.stringify(value));
  } catch (cause) {
    throw new ApiError({
      kind: "storage",
      message: `Mock storage (localStorage) is full or unavailable. Use "Reset demo data" to free space. ${
        cause instanceof Error ? cause.message : ""
      }`,
    });
  }
}

/** Blocked storage (private mode, SecurityError) surfaces as a storage ApiError, like a failed write. */
function getStorageItem(key: string): string | null {
  try {
    return getStorage().getItem(key);
  } catch (cause) {
    throw new ApiError({
      kind: "storage",
      message: `Mock storage (localStorage) is unavailable. ${cause instanceof Error ? cause.message : ""}`,
    });
  }
}

function readStorageItem(key: string): unknown {
  const storedValue = getStorageItem(key);
  if (storedValue === null) {
    return null;
  }
  try {
    return JSON.parse(storedValue);
  } catch {
    return null;
  }
}

function persistSeed(): MockDatabase {
  const seed = buildSeedDatabase();
  for (const [batchId, rows] of Object.entries(seed.batchRows)) {
    writeBatchRows(batchId, rows);
  }
  writeMockDatabase(seed.database);
  return seed.database;
}

// Stored data can come from an older app version (shape changes, or a dev server reloaded mid-change).
// Validate the records the UI renders; on any mismatch the demo state is rebuilt from the seed.
const storedDatabaseSchema = z.object({
  regulations: z.array(regulationSchema.omit({ policyIds: true, ruleIds: true })),
  policies: z.array(policySchema.omit({ ruleIds: true })),
  rules: z.array(ruleSchema),
  ruleCheckKinds: z.record(z.string(), z.string()),
  whitelistEntries: z.array(whitelistEntrySchema),
  batches: z.array(
    z.object({ batch: z.object({ id: z.string() }).loose(), ruleSnapshots: z.array(z.unknown()) }).loose(),
  ),
  // Optional: data stored before drafting jobs existed stays valid and starts with none.
  draftingJobs: z
    .array(
      z.object({
        job: z
          .object({
            id: z.string(),
            status: z.string(),
            policyIds: z.array(z.string()),
            warnings: z.array(z.string()),
          })
          .loose(),
        createdAtMs: z.number(),
        input: z.object({ kind: z.string() }).loose(),
      }),
    )
    .optional(),
});

type StoredDatabase = Omit<MockDatabase, "draftingJobs"> & { draftingJobs?: MockDraftingJobRecord[] };

function isStoredDatabase(value: unknown): value is StoredDatabase {
  return storedDatabaseSchema.safeParse(value).success;
}

function removeAllMockKeys(): void {
  const storage = getStorage();
  Object.keys(storage)
    .filter((key) => key.startsWith(MOCK_KEY_PREFIX))
    .forEach((key) => storage.removeItem(key));
  cachedBatchRows.clear();
}

export function readMockDatabase(): MockDatabase {
  if (cachedDatabase) {
    return cachedDatabase;
  }
  const storedDatabase = readStorageItem(DATABASE_KEY);
  if (isStoredDatabase(storedDatabase)) {
    cachedDatabase = { ...storedDatabase, draftingJobs: storedDatabase.draftingJobs ?? [] };
    return cachedDatabase;
  }
  if (storedDatabase !== null) {
    console.warn("Stored mock data has an outdated shape; restoring the demo seed.");
  }
  removeAllMockKeys();
  cachedDatabase = persistSeed();
  return cachedDatabase;
}

export function writeMockDatabase(database: MockDatabase): void {
  writeStorageItem(DATABASE_KEY, database);
  cachedDatabase = database;
}

export function readBatchRows(batchId: string): MockBatchRow[] {
  const cachedRows = cachedBatchRows.get(batchId);
  if (cachedRows) {
    return cachedRows;
  }
  const storedRows = readStorageItem(`${BATCH_ROWS_KEY_PREFIX}${batchId}`);
  const rows = Array.isArray(storedRows) ? (storedRows as MockBatchRow[]) : [];
  cachedBatchRows.set(batchId, rows);
  return rows;
}

export function writeBatchRows(batchId: string, rows: MockBatchRow[]): void {
  writeStorageItem(`${BATCH_ROWS_KEY_PREFIX}${batchId}`, rows);
  cachedBatchRows.set(batchId, rows);
}

/** Drops all mock state; the deterministic seed is rebuilt on the next read. */
export function resetMockDatabase(): void {
  removeAllMockKeys();
  cachedDatabase = null;
}
