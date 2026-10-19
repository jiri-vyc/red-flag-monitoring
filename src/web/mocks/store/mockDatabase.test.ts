import { buildSeedDatabase } from "../seed/buildSeedDatabase";
import { readMockDatabase, resetMockDatabase, writeMockDatabase } from "./mockDatabase";

const DATABASE_KEY = "redflag.mock.database.v3";

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
    window.localStorage.setItem("redflag.mock.database.v2", "{}");

    expect(readMockDatabase().rules).toHaveLength(seed.rules.length);
    expect(readMockDatabase().rules.every((rule) => rule.versions.every((version) => version.config))).toBe(
      true,
    );
    expect(window.localStorage.getItem("redflag.mock.database.v2")).toBeNull();
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
});

// Drops the in-memory cache while keeping localStorage, like a page reload.
function resetModuleCacheOnly(): void {
  const stored = window.localStorage.getItem(DATABASE_KEY);
  resetMockDatabase();
  if (stored !== null) {
    window.localStorage.setItem(DATABASE_KEY, stored);
  }
}
