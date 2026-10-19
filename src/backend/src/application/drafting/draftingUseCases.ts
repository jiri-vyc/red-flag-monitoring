import type { InternalPolicyVersion } from "../../domain/internalPolicy";
import type { RuleVersion } from "../../domain/rule";
import { NotFoundError } from "../errors";
import type { InternalPolicyRepository } from "../internalPolicies/internalPolicyRepository";
import type { RegulationUseCases } from "../regulations/regulationUseCases";
import type { RuleUseCases } from "../rules/ruleUseCases";
import type { DraftGenerator } from "./draftGenerator";

// Wizard steps of the minimal flow: regulation → policy drafts, approved policy → rule drafts.
export class DraftingUseCases {
  constructor(
    private readonly draftGenerator: DraftGenerator,
    private readonly regulationUseCases: RegulationUseCases,
    private readonly internalPolicyRepository: InternalPolicyRepository,
    private readonly ruleUseCases: RuleUseCases,
  ) {}

  async draftPolicies(input: {
    regulationId: string;
    regulationVersionId: string;
    createdBy: string;
  }): Promise<InternalPolicyVersion[]> {
    const regulation = await this.regulationUseCases.getRegulation(input.regulationId);
    const version = await this.regulationUseCases.getVersion(input.regulationId, input.regulationVersionId);
    const drafts = await this.draftGenerator.draftPolicies(regulation, version);
    const policyVersions: InternalPolicyVersion[] = [];

    for (const draft of drafts) {
      const policy = await this.internalPolicyRepository.createPolicy({
        code: draft.code,
        title: draft.title,
      });

      policyVersions.push(
        await this.internalPolicyRepository.createVersion({
          policyId: policy.id,
          body: draft.body,
          legalBases: draft.legalBases,
          status: "draft",
          createdVia: "wizard",
          createdBy: input.createdBy,
        }),
      );
    }

    return policyVersions;
  }

  // Called once a policy version is approved; the drafts go through their own review (M6).
  async draftRules(policyVersion: InternalPolicyVersion, createdBy: string): Promise<RuleVersion[]> {
    const policy = await this.internalPolicyRepository.findPolicy(policyVersion.policyId);

    if (!policy) {
      throw new NotFoundError("Internal policy", policyVersion.policyId);
    }

    const drafts = await this.draftGenerator.draftRules(policy, policyVersion);
    const ruleVersions: RuleVersion[] = [];

    for (const { code, alertType, kind, isWhitelistAllowed, ...logic } of drafts) {
      const rule = await this.ruleUseCases.createRule({
        policyId: policy.id,
        code,
        alertType,
        kind,
        isWhitelistAllowed,
      });

      ruleVersions.push(
        await this.ruleUseCases.createVersion({
          ...logic,
          ruleId: rule.id,
          derivedFromPolicyVersionId: policyVersion.id,
          status: "draft",
          createdVia: "wizard",
          createdBy,
        }),
      );
    }

    return ruleVersions;
  }
}
