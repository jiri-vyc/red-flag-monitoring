import type { RulesService } from "@/features/rules/api/contract";
import {
  activateRule,
  addRuleVersion,
  approveRule,
  deactivateRule,
  rejectRule,
  RuleTransitionError,
  submitRuleForReview,
  updateDraftContent,
} from "@/features/rules/domain/ruleLifecycle";
import type { AddWhitelistEntryInput, Rule, WhitelistEntry } from "@/features/rules/types";
import { CLIENT_ID_PATTERN } from "@/features/rules/whitelistEntryForm";
import { ApiError } from "@/lib/apiError";

import { createMockId } from "../createMockId";
import type { MockCheckKind } from "../evaluation/ruleChecks";
import { deriveRuleName, generateRuleDraft } from "../generation/ruleGeneration";
import { AI_GENERATION_LATENCY, simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import { readMockDatabase, writeMockDatabase } from "../store/mockDatabase";

function findRule(ruleId: string): Rule {
  const rule = readMockDatabase().rules.find((candidate) => candidate.id === ruleId);
  return rule ?? throwMockNotFound("Rule", ruleId);
}

function persistRule(updatedRule: Rule): Rule {
  const database = readMockDatabase();
  const rules = database.rules.map((rule) => (rule.id === updatedRule.id ? updatedRule : rule));
  writeMockDatabase({ ...database, rules });
  return updatedRule;
}

function persistNewRule({ rule, checkKind }: { rule: Rule; checkKind: MockCheckKind }): Rule {
  const database = readMockDatabase();
  writeMockDatabase({
    ...database,
    rules: [...database.rules, rule],
    ruleCheckKinds: { ...database.ruleCheckKinds, [rule.id]: checkKind },
  });
  return rule;
}

/** Applies a lifecycle transition and maps forbidden transitions to the shared API error shape. */
async function transitionRule(ruleId: string, transition: (rule: Rule, now: string) => Rule): Promise<Rule> {
  await simulateLatency();
  try {
    return persistRule(transition(findRule(ruleId), new Date().toISOString()));
  } catch (error) {
    if (error instanceof RuleTransitionError) {
      throw new ApiError({ kind: "validation", message: error.message });
    }
    throw error;
  }
}

function throwValidation(message: string): never {
  throw new ApiError({ kind: "validation", message });
}

function validateNewWhitelistEntry({ ruleId, clientId, reason }: AddWhitelistEntryInput): void {
  const rule = findRule(ruleId);
  if (!rule.whitelistAllowed) {
    throwValidation(`Rule "${ruleId}" is regulatory-mandatory and does not allow whitelist exceptions.`);
  }
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    throwValidation(`Client ID "${clientId}" must look like K000123.`);
  }
  if (reason.trim() === "") {
    throwValidation("A whitelist entry needs a non-empty reason.");
  }
  const isDuplicate = readMockDatabase().whitelistEntries.some(
    (entry) => entry.ruleId === ruleId && entry.clientId === clientId,
  );
  if (isDuplicate) {
    throwValidation(`Client "${clientId}" is already whitelisted for rule "${ruleId}".`);
  }
}

function findPolicyRegulationId(policyId: string): string {
  const policy = readMockDatabase().policies.find((candidate) => candidate.id === policyId);
  return policy?.regulationId ?? throwMockNotFound("Internal policy", policyId);
}

export const mockRulesService: RulesService = {
  async loadRules() {
    await simulateLatency();
    return readMockDatabase().rules;
  },

  async loadRule(ruleId) {
    await simulateLatency();
    return findRule(ruleId);
  },

  async createManualRule({ description, policyId, type, sensitivity, riskProfiles, author }) {
    await simulateLatency(AI_GENERATION_LATENCY);
    const policy = readMockDatabase().policies.find((candidate) => candidate.id === policyId);
    const generatedDraft = generateRuleDraft({ description, type });
    const now = new Date().toISOString();
    const rule: Rule = {
      id: createMockId("rule-manual"),
      name: deriveRuleName(description),
      description,
      type,
      status: "pending_for_review",
      origin: "manual",
      policyId,
      regulationId: findPolicyRegulationId(policyId),
      sourceProvision: policy?.sourceProvision ?? "",
      runningVersionNumber: null,
      versions: [
        {
          versionNumber: 1,
          state: "pending_review",
          content: generatedDraft.content,
          config: { sensitivity, riskProfiles },
          changeNote: "Vytvořeno ručně, obsah vygenerován z popisu.",
          createdAt: now,
          createdBy: author,
          reviewedBy: null,
          reviewedAt: null,
        },
      ],
      // Whitelist entries are added on the detail page afterwards.
      whitelistAllowed: true,
      createdAt: now,
      updatedAt: now,
    };
    return persistNewRule({ rule, checkKind: generatedDraft.checkKind });
  },

  submitRuleForReview: (ruleId) => transitionRule(ruleId, submitRuleForReview),
  approveRule: ({ ruleId, reviewer }) =>
    transitionRule(ruleId, (rule, now) => approveRule(rule, { reviewer, now })),
  rejectRule: ({ ruleId, reviewer }) =>
    transitionRule(ruleId, (rule, now) => rejectRule(rule, { reviewer, now })),
  activateRule: (ruleId) => transitionRule(ruleId, activateRule),
  deactivateRule: (ruleId) => transitionRule(ruleId, deactivateRule),
  createRuleVersion: ({ ruleId, content, config, changeNote, author }) =>
    transitionRule(ruleId, (rule, now) => addRuleVersion(rule, { content, config, changeNote, author, now })),
  updateDraftContent: ({ ruleId, content }) =>
    transitionRule(ruleId, (rule, now) => updateDraftContent(rule, { content, now })),

  async getWhitelist(ruleId) {
    await simulateLatency();
    findRule(ruleId);
    return readMockDatabase().whitelistEntries.filter((entry) => entry.ruleId === ruleId);
  },

  // Applies immediately: no new version and no review (M16). Approval is out of MVP scope (compliance review).
  async addWhitelistEntry({ ruleId, clientId, reason, author }) {
    await simulateLatency();
    validateNewWhitelistEntry({ ruleId, clientId, reason });
    const entry: WhitelistEntry = {
      ruleId,
      clientId,
      reason: reason.trim(),
      createdBy: author,
      createdAt: new Date().toISOString(),
    };
    const database = readMockDatabase();
    writeMockDatabase({ ...database, whitelistEntries: [...database.whitelistEntries, entry] });
    return entry;
  },

  async removeWhitelistEntry({ ruleId, clientId }) {
    await simulateLatency();
    const database = readMockDatabase();
    const isMatchingEntry = (entry: WhitelistEntry) => entry.ruleId === ruleId && entry.clientId === clientId;
    if (!database.whitelistEntries.some(isMatchingEntry)) {
      throwMockNotFound("Whitelist entry", `${ruleId}/${clientId}`);
    }
    writeMockDatabase({
      ...database,
      whitelistEntries: database.whitelistEntries.filter((entry) => !isMatchingEntry(entry)),
    });
  },
};
