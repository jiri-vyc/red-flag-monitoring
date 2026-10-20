import { ApiError } from "@/lib/apiError";

import { buildSeedDatabase } from "../seed/buildSeedDatabase";
import { readBatchRows, readMockDatabase, resetMockDatabase, writeMockDatabase } from "./mockDatabase";

const DATABASE_KEY = "redflag.mock.database.v6";
const BATCH_ROWS_KEY_PREFIX = "redflag.mock.batch-rows.v1.";

describe("mockDatabase", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockDatabase();
  });

  it("keeps stored data that matches the current shape", () => {
    const seed = buildSeedDatabase().database;
    writeMockDatabase({ ...seed, rules: seed.rules.slice(0, 1) });
    resetModuleCacheOnly();

    expect(readMockDatabase().rules).toHaveLength(1);
  });

  it("accepts the full seed, so a normal reload never wipes demo data", () => {
    const seed = buildSeedDatabase().database;
    writeMockDatabase({ ...seed, rules: seed.rules.slice(1) });
    resetModuleCacheOnly();

    expect(readMockDatabase().rules).toHaveLength(seed.rules.length - 1);
    expect(readMockDatabase().batches).toHaveLength(seed.batches.length);
  });

  it("restores the seed when stored rules have an outdated shape", () => {
    const seed = buildSeedDatabase().database;
    const outdatedRules = seed.rules.map((rule) => ({
      ...rule,
      versions: rule.versions.map((version) => ({ ...version, config: undefined })),
    }));
    window.localStorage.setItem(DATABASE_KEY, JSON.stringify({ ...seed, rules: outdatedRules }));
    resetModuleCacheOnly();
    window.localStorage.setItem("redflag.mock.database.v3", "{}");

    expect(readMockDatabase().rules).toHaveLength(seed.rules.length);
    expect(readMockDatabase().rules.every((rule) => rule.versions.every((version) => version.config))).toBe(
      true,
    );
    expect(window.localStorage.getItem("redflag.mock.database.v3")).toBeNull();
  });

  it("restores the seed when stored data still has the 1:1 regulation links", () => {
    const seed = buildSeedDatabase().database;
    // The old shape: one regulation id and a provision string instead of legal bases.
    const outdatedPolicies = seed.policies.map((policy) => ({
      ...policy,
      legalBases: undefined,
      regulationId: "reg-aml-act",
      sourceProvision: "§ 9",
    }));
    window.localStorage.setItem(
      DATABASE_KEY,
      JSON.stringify({ ...seed, policies: outdatedPolicies, rules: seed.rules.slice(1) }),
    );
    resetModuleCacheOnly();

    expect(readMockDatabase().rules).toHaveLength(seed.rules.length);
    expect(readMockDatabase().policies.every((policy) => Array.isArray(policy.legalBases))).toBe(true);
  });

  it("seeds a purely internal policy, a rule without a policy and rule versions with own legal bases", () => {
    const seed = buildSeedDatabase().database;

    expect(seed.policies.some((policy) => policy.legalBases.length === 0)).toBe(true);
    expect(seed.rules.some((rule) => rule.policyId === null)).toBe(true);
    expect(
      seed.rules.every((rule) =>
        rule.versions.every(
          (version) => version.legalBases.length > 0 && version.legalBases.every(({ ref }) => ref),
        ),
      ),
    ).toBe(true);
  });

  it("restores the seed when stored data has no whitelist entries", () => {
    const seed = buildSeedDatabase().database;
    window.localStorage.setItem(
      DATABASE_KEY,
      JSON.stringify({ ...seed, whitelistEntries: undefined, rules: seed.rules.slice(1) }),
    );
    resetModuleCacheOnly();

    expect(readMockDatabase().rules).toHaveLength(seed.rules.length);
    expect(readMockDatabase().whitelistEntries).toEqual(seed.whitelistEntries);
  });

  it.each([
    [
      "a batch without a numeric start time",
      (seed: SeedDatabase) => ({
        batches: seed.batches.map((record) => ({ ...record, startedAtMs: "yesterday" })),
      }),
    ],
    [
      "an unknown rule check kind",
      (seed: SeedDatabase) => ({
        ruleCheckKinds: { ...seed.ruleCheckKinds, [seed.rules[0].id]: "unknown_check" },
      }),
    ],
    [
      "a rule snapshot without a check kind",
      (seed: SeedDatabase) => ({
        batches: seed.batches.map((record) => ({
          ...record,
          ruleSnapshots: record.ruleSnapshots.map((snapshot) => ({ ...snapshot, checkKind: undefined })),
        })),
      }),
    ],
  ])("restores the seed when stored data has %s", (_label, corrupt) => {
    const seed = buildSeedDatabase().database;
    window.localStorage.setItem(
      DATABASE_KEY,
      JSON.stringify({ ...seed, rules: seed.rules.slice(1), ...corrupt(seed) }),
    );
    resetModuleCacheOnly();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      expect(readMockDatabase().rules).toHaveLength(seed.rules.length);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("accepts the seeded batch rows after a reload", () => {
    const seed = buildSeedDatabase();
    readMockDatabase();
    resetModuleCacheOnly();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      for (const [batchId, rows] of Object.entries(seed.batchRows)) {
        expect(readBatchRows(batchId)).toHaveLength(rows.length);
      }
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("treats stored batch rows with an outdated shape as missing", () => {
    const [batchId, rows] = Object.entries(buildSeedDatabase().batchRows)[0];
    const outdatedRows = rows.map((row) => ({
      ...row,
      transaction: { ...row.transaction, amountCzk: null },
    }));
    window.localStorage.setItem(`${BATCH_ROWS_KEY_PREFIX}${batchId}`, JSON.stringify(outdatedRows));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      expect(readBatchRows(batchId)).toEqual([]);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("reports blocked localStorage as a storage error", () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    try {
      expect(() => readMockDatabase()).toThrow(expect.objectContaining({ kind: "storage" }));
      expect(() => readMockDatabase()).toThrow(ApiError);
    } finally {
      getItem.mockRestore();
    }
  });
});

type SeedDatabase = ReturnType<typeof buildSeedDatabase>["database"];

// Drops the in-memory cache while keeping localStorage, like a page reload.
function resetModuleCacheOnly(): void {
  const storedEntries = Object.entries(window.localStorage);
  resetMockDatabase();
  storedEntries.forEach(([key, value]) => window.localStorage.setItem(key, value));
}
