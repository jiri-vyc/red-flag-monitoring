import type { Policy } from "@/features/policies/types";
import type { Regulation } from "@/features/regulations/types";
import { findRuleLegalBases } from "@/features/rules/domain/ruleLifecycle";
import { toSafeSourceUrl } from "@/lib/url";

import type { MockDatabase, MockPolicyRecord, MockRegulationRecord } from "../store/mockDatabase";

export function mapRegulationRecord(record: MockRegulationRecord, database: MockDatabase): Regulation {
  return {
    ...record,
    // Rendered as a link, so the mock enforces the same http(s)-only rule as the live adapter.
    sourceUrl: toSafeSourceUrl(record.sourceUrl),
    // M3, M5: M:N through the legal bases of the policy and of the rule's describing version.
    policyIds: database.policies
      .filter((policy) => policy.legalBases.some(({ regulationId }) => regulationId === record.id))
      .map((policy) => policy.id),
    ruleIds: database.rules
      .filter((rule) => findRuleLegalBases(rule).some(({ regulationId }) => regulationId === record.id))
      .map((rule) => rule.id),
  };
}

export function mapPolicyRecord(record: MockPolicyRecord, database: MockDatabase): Policy {
  return {
    ...record,
    ruleIds: database.rules.filter((rule) => rule.policyId === record.id).map((rule) => rule.id),
  };
}
