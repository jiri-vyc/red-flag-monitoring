import { DraftingUseCases } from "../../application/drafting/draftingUseCases";
import type { RegulationRepository } from "../../application/regulations/regulationRepository";
import { RegulationUseCases } from "../../application/regulations/regulationUseCases";
import { RuleUseCases } from "../../application/rules/ruleUseCases";
import { InMemoryInternalPolicyRepository } from "../../application/testing/InMemoryInternalPolicyRepository";
import { InMemoryRuleRepository } from "../../application/testing/InMemoryRuleRepository";
import { ADMIN_ID, fixedClock } from "../../application/testing/fixtures";
import type { PolicyLegalBasis } from "../../domain/regulation";
import { DummyDraftGenerator } from "./DummyDraftGenerator";

async function setUp(legalBases: PolicyLegalBasis[]) {
  const internalPolicyRepository = new InMemoryInternalPolicyRepository();
  const ruleRepository = new InMemoryRuleRepository();
  // draftRules never reads regulations.
  const regulationUseCases = new RegulationUseCases({} as RegulationRepository);
  const draftingUseCases = new DraftingUseCases(
    new DummyDraftGenerator(),
    regulationUseCases,
    internalPolicyRepository,
    new RuleUseCases(ruleRepository, fixedClock),
  );
  const policy = await internalPolicyRepository.createPolicy({
    code: "SVZ-TM",
    title: "Monitoring transakcí",
  });
  const policyVersion = await internalPolicyRepository.createVersion({
    policyId: policy.id,
    body: "# Monitoring",
    status: "approved",
    createdVia: "manual",
    createdBy: ADMIN_ID,
    legalBases,
  });

  return { draftingUseCases, ruleRepository, policy, policyVersion };
}

describe("DummyDraftGenerator with DraftingUseCases.draftRules", () => {
  it("creates draft rule versions that pass rule validation and point at the policy version", async () => {
    const { draftingUseCases, ruleRepository, policy, policyVersion } = await setUp([
      { regulationVersionId: "regulation-version-1", ref: "§ 21" },
    ]);

    const ruleVersions = await draftingUseCases.draftRules(policyVersion, ADMIN_ID);

    expect(ruleVersions).toHaveLength(2);
    expect(ruleVersions).toEqual(
      ruleVersions.map(() =>
        expect.objectContaining({
          status: "draft",
          createdVia: "wizard",
          derivedFromPolicyVersionId: policyVersion.id,
          legalBases: [{ regulationVersionId: "regulation-version-1", ref: "§ 21" }],
        }),
      ),
    );
    expect([...ruleRepository.rules.values()].map((rule) => rule.policyId)).toEqual([policy.id, policy.id]);
  });

  it("drafts no rules from a policy without a legal basis", async () => {
    const { draftingUseCases, policyVersion } = await setUp([]);

    expect(await draftingUseCases.draftRules(policyVersion, ADMIN_ID)).toEqual([]);
  });
});
