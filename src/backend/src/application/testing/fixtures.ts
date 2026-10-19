import { DEFAULT_ESCALATION_ROLE } from "../../domain/rule";
import type { NewRuleVersion } from "../rules/ruleRepository";

export const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
export const REVIEWED_AT = new Date("2026-10-19T10:00:00Z");
export const fixedClock = () => REVIEWED_AT;

export function buildDeterministicVersion(
  ruleId: string,
  overrides: Partial<NewRuleVersion> = {},
): NewRuleVersion {
  return {
    ruleId,
    derivedFromPolicyVersionId: null,
    definition: {
      match: "any",
      features: ["tx_amount_czk"],
      conditions: [
        {
          id: "a",
          label: "Amount over 1M CZK",
          left: { feature: "tx_amount_czk" },
          op: ">",
          right: { value: 1_000_000 },
        },
      ],
    },
    agentPrompt: null,
    agentModelId: null,
    humanText: "Transakce nad 1 000 000 CZK",
    thresholdRationale: null,
    baseScore: 80,
    sensitivity: 100,
    riskProfiles: ["low", "medium", "high"],
    escalationRole: DEFAULT_ESCALATION_ROLE,
    status: "draft",
    createdVia: "manual",
    createdBy: ADMIN_ID,
    legalBases: [{ regulationVersionId: "regulation-version-1", ref: "§ 21" }],
    ...overrides,
  };
}
