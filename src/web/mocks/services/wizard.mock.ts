import { CURRENT_USER } from "@/config/currentUser";
import type { RuleLegalBasis } from "@/features/regulations/types";
import type { Rule } from "@/features/rules/types";
import { submitRuleForReview } from "@/features/rules/domain/ruleLifecycle";
import type { WizardService } from "@/features/wizard/api/contract";
import type { RegulationTarget } from "@/features/wizard/types";

import { createMockId } from "../createMockId";
import {
  buildGeneratedPolicy,
  buildGeneratedRegulation,
  deriveRegulationFromUrl,
  describeRegulationSource,
  GENERAL_PROVISIONS_REF,
  WIZARD_RULE_BLUEPRINTS,
} from "../generation/policyGeneration";
import { deriveRuleName, generateRuleDraft } from "../generation/ruleGeneration";
import { AI_GENERATION_LATENCY, simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import {
  readMockDatabase,
  writeMockDatabase,
  type MockDatabase,
  type MockPolicyRecord,
  type MockRegulationRecord,
} from "../store/mockDatabase";
import { mapPolicyRecord, mapRegulationRecord } from "./mappers";
import { mockPoliciesService } from "./policies.mock";

const GENERATED_BY = "RedFlag AI (návrh)";

function findPolicyRecord(database: MockDatabase, policyId: string): MockPolicyRecord {
  const policy = database.policies.find((candidate) => candidate.id === policyId);
  return policy ?? throwMockNotFound("Internal policy", policyId);
}

/** M1: a new wording of an existing regulation replaces the wording the mock record shows. */
function buildRegulationRecord({
  database,
  target,
  versionLabel,
  now,
}: {
  database: MockDatabase;
  target: RegulationTarget;
  versionLabel: string;
  now: string;
}): MockRegulationRecord {
  if (target.kind === "new") {
    return buildGeneratedRegulation({ id: createMockId("reg"), regulation: target, versionLabel, now });
  }
  if (target.kind === "fromUrl") {
    const regulation = deriveRegulationFromUrl(target.url);
    return buildGeneratedRegulation({ id: createMockId("reg"), regulation, versionLabel, now });
  }
  const regulation = database.regulations.find((candidate) => candidate.id === target.regulationId);
  if (!regulation) {
    return throwMockNotFound("Regulation", target.regulationId);
  }
  return { ...regulation, version: versionLabel, lastCheckedAt: now };
}

function upsertRegulation(
  regulations: MockRegulationRecord[],
  regulation: MockRegulationRecord,
): MockRegulationRecord[] {
  const isExisting = regulations.some((candidate) => candidate.id === regulation.id);
  return isExisting
    ? regulations.map((candidate) => (candidate.id === regulation.id ? regulation : candidate))
    : [...regulations, regulation];
}

/** M5: a rule version names its own provision; the wizard proposes the policy's citations, reviewed with the rule. */
function proposeRuleLegalBases(policy: MockPolicyRecord): RuleLegalBasis[] {
  return policy.legalBases.map(({ regulationId, ref }) => ({
    regulationId,
    ref: ref ?? GENERAL_PROVISIONS_REF,
  }));
}

function generateRules(policy: MockPolicyRecord, now: string) {
  const legalBases = proposeRuleLegalBases(policy);
  return WIZARD_RULE_BLUEPRINTS.map((blueprint) => {
    const draft = generateRuleDraft({ description: blueprint.description, type: blueprint.type });
    const rule: Rule = {
      id: createMockId("rule"),
      name: deriveRuleName(blueprint.description),
      description: blueprint.description,
      type: blueprint.type,
      status: "draft",
      origin: "wizard",
      policyId: policy.id,
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
          legalBases,
        },
      ],
      whitelistAllowed: true,
      createdAt: now,
      updatedAt: now,
    };
    return { rule, checkKind: draft.checkKind };
  });
}

// Mirrors the backend flow of the live adapter: the regulation wording yields policy drafts, approving a policy
// draft yields its rule drafts. The mock drafts one policy per wording.
export const mockWizardService: WizardService = {
  capabilities: { isAvailable: true, canFetchUrl: true },

  async draftPolicies({ source, regulation: target, versionLabel }) {
    await simulateLatency(AI_GENERATION_LATENCY);
    const now = new Date().toISOString();
    const database = readMockDatabase();
    const regulation = buildRegulationRecord({ database, target, versionLabel, now });
    const policy = buildGeneratedPolicy({
      id: createMockId("pol"),
      regulation,
      sourceLabel: describeRegulationSource(source),
      now,
    });

    const updatedDatabase = {
      ...database,
      regulations: upsertRegulation(database.regulations, regulation),
      policies: [...database.policies, policy],
    };
    writeMockDatabase(updatedDatabase);
    return {
      regulation: mapRegulationRecord(regulation, updatedDatabase),
      policies: [mapPolicyRecord(policy, updatedDatabase)],
    };
  },

  async approvePolicyDraft(policyId) {
    await mockPoliciesService.approvePolicy({ policyId, approvedBy: CURRENT_USER.name });
    await simulateLatency(AI_GENERATION_LATENCY);
    const database = readMockDatabase();
    const policy = findPolicyRecord(database, policyId);
    const generated = generateRules(policy, new Date().toISOString());
    const updatedDatabase = {
      ...database,
      rules: [...database.rules, ...generated.map(({ rule }) => rule)],
      ruleCheckKinds: {
        ...database.ruleCheckKinds,
        ...Object.fromEntries(generated.map(({ rule, checkKind }) => [rule.id, checkKind])),
      },
    };
    writeMockDatabase(updatedDatabase);
    return {
      policy: mapPolicyRecord(policy, updatedDatabase),
      rules: generated.map(({ rule }) => rule),
    };
  },

  async finishRuleReview(policyIds) {
    await simulateLatency();
    const database = readMockDatabase();
    const now = new Date().toISOString();
    const isWizardRule = (rule: Rule) => rule.policyId !== null && policyIds.includes(rule.policyId);
    const rules = database.rules.map((rule) =>
      isWizardRule(rule) && rule.status === "draft" ? submitRuleForReview(rule, now) : rule,
    );
    writeMockDatabase({ ...database, rules });
    return rules.filter(isWizardRule);
  },
};
