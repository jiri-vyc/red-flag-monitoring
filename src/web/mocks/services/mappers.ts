import type { Policy } from "@/features/policies/types";
import type { Regulation } from "@/features/regulations/types";

import type { MockDatabase, MockPolicyRecord, MockRegulationRecord } from "../store/mockDatabase";

export function mapRegulationRecord(record: MockRegulationRecord, database: MockDatabase): Regulation {
  return {
    ...record,
    policyIds: database.policies
      .filter((policy) => policy.regulationId === record.id)
      .map((policy) => policy.id),
    ruleIds: database.rules.filter((rule) => rule.regulationId === record.id).map((rule) => rule.id),
  };
}

export function mapPolicyRecord(record: MockPolicyRecord, database: MockDatabase): Policy {
  return {
    ...record,
    ruleIds: database.rules.filter((rule) => rule.policyId === record.id).map((rule) => rule.id),
  };
}
