import type { RulesService } from "@/features/rules/api/contract";
import {
  activateRule,
  addRuleVersion,
  approveRule,
  canDeleteRule,
  deactivateRule,
  rejectRule,
  RuleTransitionError,
  submitRuleForReview,
  updateDraftContent,
} from "@/features/rules/domain/ruleLifecycle";
import type { RuleLegalBasis } from "@/features/regulations/types";
import type {
  AddWhitelistEntryInput,
  CreateManualRuleInput,
  Rule,
  WhitelistEntry,
} from "@/features/rules/types";
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

/** Mirrors the backend: a policy is optional (M4), a rule version needs 1..N unique legal bases (M5). */
function validateManualRuleSource({
  policyId,
  legalBases,
}: Pick<CreateManualRuleInput, "policyId" | "legalBases">): RuleLegalBasis[] {
  const database = readMockDatabase();
  if (policyId !== null && !database.policies.some((policy) => policy.id === policyId)) {
    throwMockNotFound("Internal policy", policyId);
  }
  const trimmedLegalBases = legalBases.map(({ regulationId, ref }) => ({ regulationId, ref: ref.trim() }));
  if (trimmedLegalBases.length === 0 || trimmedLegalBases.some(({ ref }) => ref === "")) {
    throwValidation("A rule needs at least one legal basis with a provision reference.");
  }
  for (const { regulationId } of trimmedLegalBases) {
    if (!database.regulations.some((regulation) => regulation.id === regulationId)) {
      throwMockNotFound("Regulation", regulationId);
    }
  }
  const uniqueKeys = new Set(trimmedLegalBases.map(({ regulationId, ref }) => `${regulationId}|${ref}`));
  if (uniqueKeys.size !== trimmedLegalBases.length) {
    throwValidation("Legal bases must be unique.");
  }
  return trimmedLegalBases;
}

export const mockRulesService: RulesService = {
  capabilities: {
    canEditDraftContent: true,
    canCreateDeterministicRule: true,
    canCreateAgenticRule: true,
    canSuggestWhitelistClients: true,
    canDeleteRule: true,
  },

  async loadRules() {
    await simulateLatency();
    return readMockDatabase().rules;
  },

  async loadRule(ruleId) {
    await simulateLatency();
    return findRule(ruleId);
  },

  async createManualRule({
    description,
    policyId,
    type,
    sensitivity,
    riskProfiles,
    escalationRole,
    legalBases,
    author,
  }) {
    await simulateLatency(AI_GENERATION_LATENCY);
    const validLegalBases = validateManualRuleSource({ policyId, legalBases });
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
      runningVersionNumber: null,
      versions: [
        {
          versionNumber: 1,
          state: "pending_review",
          content: generatedDraft.content,
          config: { sensitivity, riskProfiles, escalationRole },
          baseScore: null,
          changeNote: "Vytvořeno ručně, obsah vygenerován z popisu.",
          createdAt: now,
          createdBy: author,
          reviewedBy: null,
          reviewedAt: null,
          legalBases: validLegalBases,
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
  approveRule: ({ ruleId, reviewer, escalationRole }) =>
    transitionRule(ruleId, (rule, now) => approveRule(rule, { reviewer, now, escalationRole })),
  // The web rule version has no review comment, so the mock only checks that a reason was given.
  rejectRule: ({ ruleId, reviewer, comment, escalationRole }) => {
    if (comment.trim() === "") {
      return throwValidation("A rejection needs a reason.");
    }
    return transitionRule(ruleId, (rule, now) => rejectRule(rule, { reviewer, now, escalationRole }));
  },
  activateRule: (ruleId) => transitionRule(ruleId, activateRule),
  deactivateRule: (ruleId) => transitionRule(ruleId, deactivateRule),
  createRuleVersion: ({ ruleId, content, config, changeNote, author }) =>
    transitionRule(ruleId, (rule, now) => addRuleVersion(rule, { content, config, changeNote, author, now })),
  updateDraftContent: ({ ruleId, content, config }) =>
    transitionRule(ruleId, (rule, now) => updateDraftContent(rule, { content, config, now })),

  // The UI only offers deletion for a rule that never had an approved version; this check is the safety net.
  async deleteRule({ ruleId }) {
    await simulateLatency();
    if (!canDeleteRule(findRule(ruleId))) {
      throwValidation(`Rule "${ruleId}" had an approved version and can only be switched off.`);
    }
    const database = readMockDatabase();
    // The rule's versions live inside the rule record, so dropping it removes them too.
    const ruleCheckKinds = Object.fromEntries(
      Object.entries(database.ruleCheckKinds).filter(([checkedRuleId]) => checkedRuleId !== ruleId),
    );
    writeMockDatabase({
      ...database,
      rules: database.rules.filter((rule) => rule.id !== ruleId),
      ruleCheckKinds,
      whitelistEntries: database.whitelistEntries.filter((entry) => entry.ruleId !== ruleId),
    });
  },

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
