import { formatAuditLine } from "./auditLog";

describe("formatAuditLine", () => {
  it("writes the fields in the order the Logs Insights query parses, with the payload last", () => {
    expect(
      formatAuditLine({
        action: "whitelist_entry.removed",
        entityType: "whitelist_entry",
        entityId: "rule-1:K000001",
        actorId: "user-1",
        payload: { reason: "Repeated FP, low risk" },
      }),
    ).toBe(
      "[audit] action=whitelist_entry.removed entity_type=whitelist_entry entity_id=rule-1:K000001 " +
        'actor_id=user-1 payload={"reason":"Repeated FP, low risk"} [/audit]',
    );
  });

  it("marks a missing actor and keeps tokens free of spaces", () => {
    expect(
      formatAuditLine({ action: "rule.enabled", entityType: "rule", entityId: "a b", actorId: null }),
    ).toBe("[audit] action=rule.enabled entity_type=rule entity_id=a_b actor_id=none payload={} [/audit]");
  });
});
