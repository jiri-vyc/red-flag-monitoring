import { groupRuleHitsIntoAmlEvents, type RuleHit } from "./amlEvent";

function createHit(overrides: Partial<RuleHit>): RuleHit {
  return {
    ruleEvaluationId: "re-1",
    ruleId: "rule-a",
    ruleVersionId: "rule-a-v1",
    ruleCode: "R-01",
    alertType: "profile_mismatch",
    alertGranularity: "client_month",
    clientId: "K000001",
    transactionId: "TX000000001",
    occurredAt: new Date(2026, 6, 3, 10, 0),
    adjustedScore: 58,
    ...overrides,
  };
}

describe("groupRuleHitsIntoAmlEvents", () => {
  it("returns no events without hits", () => {
    expect(groupRuleHitsIntoAmlEvents([])).toEqual([]);
  });

  it("makes one event per client and month for client_month rules", () => {
    const events = groupRuleHitsIntoAmlEvents([
      createHit({ ruleEvaluationId: "re-1", transactionId: "TX000000001", adjustedScore: 58 }),
      createHit({ ruleEvaluationId: "re-2", transactionId: "TX000000002", adjustedScore: 71 }),
      createHit({ ruleEvaluationId: "re-3", occurredAt: new Date(2026, 7, 1, 0, 0) }),
      createHit({ ruleEvaluationId: "re-4", clientId: "K000002" }),
    ]);

    expect(events.map((event) => [event.alertId, event.ruleEvaluationIds])).toEqual([
      ["R-01-K000001-2026-07", ["re-1", "re-2"]],
      ["R-01-K000001-2026-08", ["re-3"]],
      ["R-01-K000002-2026-07", ["re-4"]],
    ]);
    expect(events[0]).toMatchObject({ transactionId: null, periodMonth: "2026-07", maxScore: 71 });
  });

  it("makes one event per transaction for transaction rules", () => {
    const events = groupRuleHitsIntoAmlEvents([
      createHit({ ruleEvaluationId: "re-1", alertGranularity: "transaction", ruleCode: "R-02" }),
      createHit({
        ruleEvaluationId: "re-2",
        alertGranularity: "transaction",
        ruleCode: "R-02",
        transactionId: "TX000000002",
      }),
    ]);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      alertId: "R-02-TX000000001",
      transactionId: "TX000000001",
      periodMonth: null,
      ruleEvaluationIds: ["re-1"],
    });
  });

  it("keeps hits of different rules on the same client in separate events", () => {
    const events = groupRuleHitsIntoAmlEvents([
      createHit({ ruleEvaluationId: "re-1" }),
      createHit({ ruleEvaluationId: "re-2", ruleId: "rule-c", ruleVersionId: "rule-c-v1", ruleCode: "R-04" }),
    ]);

    expect(events.map((event) => event.alertId)).toEqual(["R-01-K000001-2026-07", "R-04-K000001-2026-07"]);
  });

  it("puts the month by the stored wall-clock time, not UTC", () => {
    const [event] = groupRuleHitsIntoAmlEvents([createHit({ occurredAt: new Date(2026, 6, 31, 23, 30) })]);

    expect(event?.periodMonth).toBe("2026-07");
  });
});
