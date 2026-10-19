import { access, readdir } from "node:fs/promises";
import path from "node:path";

import {
  POLICY_SEEDS,
  REGULATION_SEEDS,
  RULE_LINK_SEEDS,
} from "./migrations/1792440000000-SeedRegulationsAndPolicies";

// Lives outside migrations/ because every file there is loaded as a migration.
const KNOWLEDGE_BASE_DIRECTORY = path.resolve(__dirname, "../../../../../knowledgebase");

describe("regulations and policies seed migration", () => {
  it("seeds every regulation full text in the knowledge base exactly once", async () => {
    const files = await readdir(path.join(KNOWLEDGE_BASE_DIRECTORY, "regulace/plne-zneni"));

    expect(REGULATION_SEEDS.map((regulation) => regulation.fileName).sort()).toEqual(
      files.filter((file) => file.endsWith(".md")).sort(),
    );
  });

  it("finds every seeded policy file", async () => {
    for (const policy of POLICY_SEEDS) {
      await expect(
        access(path.join(KNOWLEDGE_BASE_DIRECTORY, "vnitrni-predpisy", policy.fileName)),
      ).resolves.toBeUndefined();
    }
  });

  it("uses unique regulation and policy codes", () => {
    const regulationCodes = REGULATION_SEEDS.map((regulation) => regulation.code);
    const policyCodes = POLICY_SEEDS.map((policy) => policy.code);

    expect(new Set(regulationCodes).size).toBe(regulationCodes.length);
    expect(new Set(policyCodes).size).toBe(policyCodes.length);
  });

  it("links policy and rule legal bases only to seeded regulations", () => {
    const regulationCodes = new Set(REGULATION_SEEDS.map((regulation) => regulation.code));
    const legalBasisCodes = [
      ...POLICY_SEEDS.flatMap((policy) => policy.legalBases),
      ...RULE_LINK_SEEDS.flatMap((ruleLink) => ruleLink.legalBases),
    ].map((legalBasis) => legalBasis.regulationCode);

    expect(legalBasisCodes.filter((code) => !regulationCodes.has(code))).toEqual([]);
  });

  it("links every sample rule in the knowledge base exactly once, to a seeded policy", async () => {
    const files = await readdir(path.join(KNOWLEDGE_BASE_DIRECTORY, "pravidla-priklady"));
    const ruleCodesFromFiles = files
      .flatMap((file) => /^r-(\d{2})-.+\.md$/.exec(file)?.[1] ?? [])
      .map((number) => `R-${number}`);
    const policyCodes = new Set(POLICY_SEEDS.map((policy) => policy.code));

    expect(RULE_LINK_SEEDS.map((ruleLink) => ruleLink.ruleCode).sort()).toEqual(ruleCodesFromFiles.sort());
    expect(RULE_LINK_SEEDS.filter((ruleLink) => !policyCodes.has(ruleLink.policyCode))).toEqual([]);
  });
});
