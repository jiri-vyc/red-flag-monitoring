import { CURRENT_USER } from "@/config/currentUser";
import type { DraftingSourceKind } from "@/features/draftingJobs/types";
import { submitRuleForReview } from "@/features/rules/domain/ruleLifecycle";
import type { Rule } from "@/features/rules/types";
import type { WizardService } from "@/features/wizard/api/contract";
import type { RegulationSource, RegulationTarget } from "@/features/wizard/types";
import { assertUnreachable } from "@/lib/assertUnreachable";

import { createMockId } from "../createMockId";
import {
  buildGeneratedRegulation,
  deriveRegulationFromUrl,
  describeRegulationSource,
} from "../generation/policyGeneration";
import { simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import {
  writeMockDatabase,
  type MockDatabase,
  type MockPolicyRecord,
  type MockRegulationRecord,
} from "../store/mockDatabase";
import { addMockDraftingJob, advanceMockDraftingJobs } from "./draftingJobs.mock";
import { mapPolicyRecord, mapRegulationRecord } from "./mappers";
import { mockPoliciesService } from "./policies.mock";

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

function toSourceKind(source: RegulationSource): DraftingSourceKind {
  switch (source.kind) {
    case "file":
      return "markdown";
    case "text":
      return "text";
    case "url":
      return "url";
    default:
      return assertUnreachable(source);
  }
}

function findRulesOfPolicies(database: MockDatabase, policyIds: string[]): Rule[] {
  return database.rules.filter((rule) => rule.policyId !== null && policyIds.includes(rule.policyId));
}

// Mirrors the backend flow of the live adapter: the regulation source starts a policy job, approving a policy
// draft starts its rules job. The simulated worker drafts one policy per wording.
export const mockWizardService: WizardService = {
  capabilities: { isAvailable: true, canFetchUrl: true },

  async startPolicyDrafting({ source, regulation: target, versionLabel }) {
    await simulateLatency();
    const now = new Date().toISOString();
    const database = advanceMockDraftingJobs();
    const regulation = buildRegulationRecord({ database, target, versionLabel, now });
    const { database: updatedDatabase, job } = addMockDraftingJob(
      { ...database, regulations: upsertRegulation(database.regulations, regulation) },
      {
        parentJobId: null,
        sourceKind: toSourceKind(source),
        sourceUrl: source.kind === "url" ? source.url : null,
        regulationId: regulation.id,
        input: { kind: "policy_from_regulation", sourceLabel: describeRegulationSource(source) },
      },
    );
    writeMockDatabase(updatedDatabase);
    return job;
  },

  async loadPolicyDraft({ regulationId, policyIds }) {
    await simulateLatency();
    const database = advanceMockDraftingJobs();
    const regulation = database.regulations.find((candidate) => candidate.id === regulationId);
    if (!regulation) {
      return throwMockNotFound("Regulation", regulationId ?? "–");
    }
    return {
      regulation: mapRegulationRecord(regulation, database),
      policies: policyIds.map((policyId) => mapPolicyRecord(findPolicyRecord(database, policyId), database)),
    };
  },

  approvePolicyDraft(policyId) {
    return mockPoliciesService.approvePolicy({ policyId, approvedBy: CURRENT_USER.name });
  },

  async findRulesJobs(policyIds) {
    await simulateLatency();
    const records = advanceMockDraftingJobs().draftingJobs.toReversed();
    return policyIds.flatMap((policyId) => {
      const newestRecord = records.find(
        ({ input }) => input.kind === "rules_from_policy" && input.policyId === policyId,
      );
      return newestRecord ? [newestRecord.job] : [];
    });
  },

  async loadDraftedRules(policyIds) {
    await simulateLatency();
    return findRulesOfPolicies(advanceMockDraftingJobs(), policyIds);
  },

  async finishRuleReview(policyIds) {
    await simulateLatency();
    const database = advanceMockDraftingJobs();
    const now = new Date().toISOString();
    const rules = database.rules.map((rule) =>
      rule.policyId !== null && policyIds.includes(rule.policyId) && rule.status === "draft"
        ? submitRuleForReview(rule, now)
        : rule,
    );
    const updatedDatabase = { ...database, rules };
    writeMockDatabase(updatedDatabase);
    return findRulesOfPolicies(updatedDatabase, policyIds);
  },
};
