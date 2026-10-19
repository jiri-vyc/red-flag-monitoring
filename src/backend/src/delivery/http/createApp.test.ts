import request from "supertest";

import { RuleUseCases } from "../../application/rules/ruleUseCases";
import { InMemoryRuleRepository } from "../../application/testing/InMemoryRuleRepository";
import { fixedClock } from "../../application/testing/fixtures";
import { type AppUseCases, createApp } from "./createApp";

const RULE_ID = "6f1c2f9e-4a8b-4c1d-9e2f-0a1b2c3d4e5f";

function createTestApp() {
  const ruleRepository = new InMemoryRuleRepository();
  ruleRepository.rules.set(RULE_ID, {
    id: RULE_ID,
    policyId: null,
    code: "A",
    alertType: "unusual_amount",
    kind: "deterministic",
    isEnabled: false,
    activeVersionId: null,
    isWhitelistAllowed: true,
    createdAt: new Date(0),
  });
  // Only the rules routes are exercised here; the other use cases are never called.
  const useCases = { rules: new RuleUseCases(ruleRepository, fixedClock) } as AppUseCases;

  return createApp(useCases);
}

describe("HTTP app", () => {
  it("reports health", async () => {
    const response = await request(createTestApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns 404 for unknown routes", async () => {
    const response = await request(createTestApp()).get("/api/unknown");

    expect(response.status).toBe(404);
  });

  it("rejects invalid path parameters with 400", async () => {
    const response = await request(createTestApp()).get("/api/rules/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.issues).toEqual([expect.objectContaining({ path: ["ruleId"] })]);
  });

  it("rejects a malformed JSON body with 400", async () => {
    const response = await request(createTestApp())
      .post("/api/rules")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
  });

  it("maps a missing entity to 404", async () => {
    const response = await request(createTestApp()).get("/api/rules/0b9a8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d");

    expect(response.status).toBe(404);
  });

  it("maps a business rule violation to 422", async () => {
    const response = await request(createTestApp()).post(`/api/rules/${RULE_ID}/enable`);

    expect(response.status).toBe(422);
  });
});
