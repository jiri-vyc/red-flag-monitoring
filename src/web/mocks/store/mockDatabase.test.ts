import { buildSeedDatabase } from "../seed/buildSeedDatabase";
import { readMockDatabase, resetMockDatabase, writeMockDatabase } from "./mockDatabase";

const DATABASE_KEY = "redflag.mock.database.v6";

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
});

// Drops the in-memory cache while keeping localStorage, like a page reload.
function resetModuleCacheOnly(): void {
  const stored = window.localStorage.getItem(DATABASE_KEY);
  resetMockDatabase();
  if (stored !== null) {
    window.localStorage.setItem(DATABASE_KEY, stored);
  }
}
