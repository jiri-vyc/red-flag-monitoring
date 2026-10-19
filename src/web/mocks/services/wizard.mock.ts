import type { Rule } from "@/features/rules/types";
import { submitRuleForReview } from "@/features/rules/domain/ruleLifecycle";
import type { WizardService } from "@/features/wizard/api/contract";
import type { RegulationSource } from "@/features/wizard/types";

import { createMockId } from "../createMockId";
import {
  buildGeneratedPolicy,
  buildGeneratedRegulation,
  WIZARD_RULE_BLUEPRINTS,
} from "../generation/policyGeneration";
import { deriveRuleName, generateRuleDraft } from "../generation/ruleGeneration";
import { AI_GENERATION_LATENCY, simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import { readMockDatabase, writeMockDatabase, type MockRegulationRecord } from "../store/mockDatabase";
import { mapPolicyRecord, mapRegulationRecord } from "./mappers";

const GENERATED_BY = "RedFlag AI (návrh)";

function findRegulationBySourceUrl(source: RegulationSource): MockRegulationRecord | null {
  if (source.kind !== "url") {
    return null;
  }
  const normalizedUrl = source.url.trim().replace(/\/$/, "");
  const regulations = readMockDatabase().regulations;
  return regulations.find((regulation) => regulation.sourceUrl.replace(/\/$/, "") === normalizedUrl) ?? null;
}

function findPolicyRecord(policyId: string) {
  const policy = readMockDatabase().policies.find((candidate) => candidate.id === policyId);
  return policy ?? throwMockNotFound("Internal policy", policyId);
}

export const mockWizardService: WizardService = {
  async generatePolicyDraft({ source, regulationName }) {
    await simulateLatency(AI_GENERATION_LATENCY);
    const now = new Date().toISOString();
    const existingRegulation = findRegulationBySourceUrl(source);
    const regulation =
      existingRegulation ??
      buildGeneratedRegulation({ id: createMockId("reg"), source, regulationName, now });
    const policy = buildGeneratedPolicy({ id: createMockId("pol"), regulation, now });

    const database = readMockDatabase();
    const updatedDatabase = {
      ...database,
      regulations: existingRegulation ? database.regulations : [...database.regulations, regulation],
      policies: [...database.policies, policy],
    };
    writeMockDatabase(updatedDatabase);
    return {
      regulation: mapRegulationRecord(regulation, updatedDatabase),
      policy: mapPolicyRecord(policy, updatedDatabase),
    };
  },

  async generateRules(policyId) {
    await simulateLatency(AI_GENERATION_LATENCY);
    const policy = findPolicyRecord(policyId);
    const now = new Date().toISOString();
    const generated = WIZARD_RULE_BLUEPRINTS.map((blueprint) => {
      const draft = generateRuleDraft({ description: blueprint.description, type: blueprint.type });
      const rule: Rule = {
        id: createMockId("rule"),
        name: deriveRuleName(blueprint.description),
        description: blueprint.description,
        type: blueprint.type,
        status: "draft",
        origin: "wizard",
        policyId,
        regulationId: policy.regulationId,
        sourceProvision: policy.sourceProvision,
        runningVersionNumber: null,
        versions: [
          {
            versionNumber: 1,
            state: "draft",
            content: draft.content,
            config: {
              sensitivity: blueprint.sensitivity,
              riskProfiles: ["high", "medium", "low", "unknown"],
            },
            changeNote: "Vygenerováno wizardem z interního předpisu.",
            createdAt: now,
            createdBy: GENERATED_BY,
            reviewedBy: null,
            reviewedAt: null,
          },
        ],
        whitelistAllowed: true,
        createdAt: now,
        updatedAt: now,
      };
      return { rule, checkKind: draft.checkKind };
    });

    const database = readMockDatabase();
    writeMockDatabase({
      ...database,
      rules: [...database.rules, ...generated.map(({ rule }) => rule)],
      ruleCheckKinds: {
        ...database.ruleCheckKinds,
        ...Object.fromEntries(generated.map(({ rule, checkKind }) => [rule.id, checkKind])),
      },
    });
    return generated.map(({ rule }) => rule);
  },

  async finishRuleReview(policyId) {
    await simulateLatency();
    const database = readMockDatabase();
    const now = new Date().toISOString();
    const rules = database.rules.map((rule) =>
      rule.policyId === policyId && rule.status === "draft" ? submitRuleForReview(rule, now) : rule,
    );
    writeMockDatabase({ ...database, rules });
    return rules.filter((rule) => rule.policyId === policyId);
  },
};
