import {
  applyGuardrails,
  calculateAlertPriority,
  type ClientTriageCase,
  proposeRuleBasedTriage,
  type TriageAlert,
  type TriageAlertHit,
  type TriageProposal,
} from "./alertTriage";
import type { Client } from "./client";

const CLIENT: Client = {
  clientId: "K000001",
  country: "CZ",
  contractDate: "2015-03-01",
  contractChannel: "in_person",
  isPep: false,
  clientType: "natural_person",
  projectedMonthlyVolumeCzk: "100000.00",
  projectedMonthlyTxCount: 20,
  q2VolumeCzk: "300000.00",
  q2TxCount: 60,
  q2MaxTxCzk: "20000.00",
  amlRiskScore: "low",
};

const BASE_HIT: TriageAlertHit = {
  transactionId: "TX000000001",
  occurredAt: new Date(2026, 6, 10),
  amountCzk: 50_000,
  transactionType: "incoming",
  payerCountry: "CZ",
  payeeCountry: "CZ",
  metConditionIds: ["b"],
  traceSummary: "Splněno: b",
};

function createAlert(overrides: Partial<TriageAlert> = {}): TriageAlert {
  return {
    amlEventId: "event-r01",
    alertId: "R-01-K000001-2026-07",
    ruleCode: "R-01",
    ruleVersionId: "version-r01",
    ruleText: "Nesoulad s profilem klienta",
    alertType: "profile_mismatch",
    transactionId: null,
    periodMonth: "2026-07",
    maxScore: 58,
    anyConditionCount: 3,
    hits: [BASE_HIT],
    ...overrides,
  };
}

function createCase(overrides: Partial<ClientTriageCase> = {}): ClientTriageCase {
  return {
    client: CLIENT,
    alerts: [createAlert()],
    activityByMonth: new Map([["2026-07", { volumeCzk: 150_000, txCount: 25, maxTxCzk: 50_000 }]]),
    highRiskCountries: new Set(["IR"]),
    ...overrides,
  };
}

describe("calculateAlertPriority", () => {
  it("is the scenario base for a low-risk long-standing client", () => {
    const triageCase = createCase();

    expect(calculateAlertPriority(triageCase, createAlert())).toEqual({
      priority: 15,
      factors: [{ code: "scenario_base", label: "Scenario base R-01", points: 15 }],
    });
  });

  it("adds the table P modifiers of the client", () => {
    const triageCase = createCase({
      client: {
        ...CLIENT,
        amlRiskScore: "high",
        isPep: true,
        contractChannel: "distant",
        contractDate: "2026-01-15",
      },
    });

    expect(
      calculateAlertPriority(triageCase, createAlert()).factors.map(({ code, points }) => [code, points]),
    ).toEqual([
      ["scenario_base", 15],
      ["aml_risk_score", 20],
      ["pep", 15],
      ["distant_contract", 5],
      ["short_relationship", 5],
    ]);
  });

  it("takes the highest base and adds every other scenario of the client in the month", () => {
    const passThrough = createAlert({
      amlEventId: "event-r04",
      alertId: "R-04-K000001-2026-07",
      ruleCode: "R-04",
    });
    const triageCase = createCase({ alerts: [createAlert(), passThrough] });

    expect(calculateAlertPriority(triageCase, createAlert())).toMatchObject({
      priority: 65,
      factors: [
        { code: "scenario_base", label: "Highest scenario base on the client: R-04", points: 55 },
        { code: "additional_scenarios", points: 10 },
      ],
    });
  });

  it("adds points when all conditions of the rule are met and the volume is far over the projection", () => {
    const alert = createAlert({
      hits: [{ ...BASE_HIT, metConditionIds: ["a", "b", "c"] }],
    });
    const triageCase = createCase({
      alerts: [alert],
      activityByMonth: new Map([["2026-07", { volumeCzk: 600_000, txCount: 25, maxTxCzk: 50_000 }]]),
    });

    expect(calculateAlertPriority(triageCase, alert).priority).toBe(35);
  });

  it("caps the priority at 100", () => {
    const alert = createAlert({ ruleCode: "R-16" });
    const pepCase = createCase({
      client: { ...CLIENT, amlRiskScore: "high", isPep: true, country: "IR" },
      alerts: [alert],
    });

    expect(calculateAlertPriority(pepCase, alert).priority).toBe(100);
  });
});

describe("proposeRuleBasedTriage", () => {
  it("proposes FP when the month volume is in line with the client's history", () => {
    const [proposal] = proposeRuleBasedTriage(createCase());

    expect(proposal).toMatchObject({ triage: "FP", guardrails: [] });
    expect(proposal?.reason).toContain("consistent with the client's profile");
  });

  it("proposes REVIEW when the month volume leaves the expected range", () => {
    const triageCase = createCase({
      activityByMonth: new Map([["2026-07", { volumeCzk: 400_000, txCount: 25, maxTxCzk: 50_000 }]]),
    });

    expect(proposeRuleBasedTriage(triageCase)[0]).toMatchObject({ triage: "REVIEW" });
  });

  it("always proposes REVIEW behind a guardrail", () => {
    const triageCase = createCase({ client: { ...CLIENT, isPep: true } });

    expect(proposeRuleBasedTriage(triageCase)[0]).toMatchObject({
      triage: "REVIEW",
      guardrails: ["pep_client"],
    });
  });

  it("flags a counterparty from a high-risk jurisdiction", () => {
    const alert = createAlert({ hits: [{ ...BASE_HIT, payerCountry: "IR" }] });

    expect(proposeRuleBasedTriage(createCase({ alerts: [alert] }))[0]?.guardrails).toEqual([
      "high_risk_jurisdiction",
    ]);
  });
});

describe("applyGuardrails", () => {
  const proposal: TriageProposal = {
    amlEventId: "event-r01",
    triage: "REVIEW",
    priority: { priority: 30, factors: [] },
    reason: "PEP",
    guardrails: ["pep_client"],
  };

  it("turns a model FP behind a guardrail into REVIEW", () => {
    expect(applyGuardrails(proposal, "FP")).toEqual({ triage: "REVIEW", isOverridden: true });
  });

  it("keeps the model's REVIEW", () => {
    expect(applyGuardrails(proposal, "REVIEW")).toEqual({ triage: "REVIEW", isOverridden: false });
  });
});
