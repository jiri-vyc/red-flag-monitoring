import request from "supertest";

import { DatabaseStatusQueries } from "../../application/databaseStatus/databaseStatusQueries";
import { EvaluationRunUseCases } from "../../application/evaluationRuns/evaluationRunUseCases";
import type { DatabaseStatus } from "../../application/databaseStatus/databaseStatusProbe";
import { RuleUseCases } from "../../application/rules/ruleUseCases";
import { InMemoryRuleRepository } from "../../application/testing/InMemoryRuleRepository";
import { fixedClock } from "../../application/testing/fixtures";
import { type AppUseCases, createApp } from "./createApp";

const RULE_ID = "6f1c2f9e-4a8b-4c1d-9e2f-0a1b2c3d4e5f";

const databaseReady = async () => undefined;

const AURORA_STATUS: DatabaseStatus = {
  databaseName: "main",
  serverAddress: "10.0.1.23",
  serverVersion: "PostgreSQL 17.5 on aarch64-unknown-linux-gnu",
  auroraVersion: "17.5.1",
  serverTime: new Date("2026-10-19T12:00:00Z"),
  latestMigration: "SeedAdminUser1792430445133",
  clientCount: 5493,
};

function createDatabaseStatusApp(loadDatabaseStatus: () => Promise<DatabaseStatus>) {
  const useCases = { databaseStatus: new DatabaseStatusQueries({ loadDatabaseStatus }) } as AppUseCases;

  return createApp(useCases, databaseReady);
}

function createTestApp(ensureDatabaseReady = databaseReady) {
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

  return createApp(useCases, ensureDatabaseReady);
}

describe("HTTP app", () => {
  it("reports health", async () => {
    const response = await request(createTestApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("reports health without waiting for the database", async () => {
    const response = await request(createTestApp(() => new Promise(() => {}))).get("/api/health");

    expect(response.status).toBe(200);
  });

  it("returns 500 when the database cannot be initialized", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const failingDatabase = () => Promise.reject(new Error("Aurora unavailable"));

    const response = await request(createTestApp(failingDatabase)).get(`/api/rules/${RULE_ID}`);
    consoleError.mockRestore();

    expect(response.status).toBe(500);
  });

  it("reports which database server the backend is connected to", async () => {
    const response = await request(createDatabaseStatusApp(async () => AURORA_STATUS)).get(
      "/api/database-status",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...AURORA_STATUS, serverTime: "2026-10-19T12:00:00.000Z" });
  });

  it("returns 500 when the database status query fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const failingProbe = () => Promise.reject(new Error('relation "clients" does not exist'));

    const response = await request(createDatabaseStatusApp(failingProbe)).get("/api/database-status");
    consoleError.mockRestore();

    expect(response.status).toBe(500);
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

  it("answers 501 when starting an evaluation run, the engine is not implemented yet", async () => {
    const useCases = { evaluationRunUseCases: new EvaluationRunUseCases() } as AppUseCases;

    const response = await request(createApp(useCases, databaseReady)).post("/api/evaluation-runs");

    expect(response.status).toBe(501);
  });
});
