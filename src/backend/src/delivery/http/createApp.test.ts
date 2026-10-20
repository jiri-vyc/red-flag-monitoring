import request from "supertest";

import { DatabaseStatusQueries } from "../../application/databaseStatus/databaseStatusQueries";
import type { DatabaseStatus } from "../../application/databaseStatus/databaseStatusProbe";
import { DraftingJobUseCases } from "../../application/drafting/draftingJobUseCases";
import { RegulationUseCases } from "../../application/regulations/regulationUseCases";
import type { PageRequest } from "../../application/pagination";
import { RuleUseCases } from "../../application/rules/ruleUseCases";
import { InMemoryDraftingJobRepository } from "../../application/testing/InMemoryDraftingJobRepository";
import { InMemoryInternalPolicyRepository } from "../../application/testing/InMemoryInternalPolicyRepository";
import { InMemoryRegulationRepository } from "../../application/testing/InMemoryRegulationRepository";
import { InMemoryRuleRepository } from "../../application/testing/InMemoryRuleRepository";
import { ADMIN_ID, fixedClock, REVIEWED_AT } from "../../application/testing/fixtures";
import { TransactionQueries } from "../../application/transactions/transactionQueries";
import type { TransactionFilter } from "../../application/transactions/transactionRepository";
import { UserUseCases } from "../../application/users/userUseCases";
import type { Transaction } from "../../domain/transaction";
import type { User } from "../../domain/user";
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

function createDraftingJobsApp() {
  const draftingJobs = new DraftingJobUseCases({
    draftingJobRepository: new InMemoryDraftingJobRepository(
      new InMemoryInternalPolicyRepository(),
      new InMemoryRuleRepository(),
      REVIEWED_AT,
    ),
    draftingJobLauncher: { launchJob: () => Promise.resolve() },
    regulationUseCases: new RegulationUseCases(new InMemoryRegulationRepository()),
    clock: fixedClock,
  });

  return createApp({ draftingJobs } as AppUseCases, databaseReady);
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

  it.each([
    ["with a createdBy that is not a UUID", { createdBy: "admin" }],
    [
      "with scope.from after scope.to",
      { createdBy: ADMIN_ID, scope: { from: "2026-07-10", to: "2026-07-01" } },
    ],
    ["with a timestamp that has an offset", { createdBy: ADMIN_ID, scope: { from: "2026-07-01T00:00:00Z" } }],
  ])("rejects starting an evaluation run %s", async (_case, body) => {
    // Validation fails before the use case is called.
    const useCases = { evaluationRunUseCases: {} } as AppUseCases;

    const response = await request(createApp(useCases, databaseReady))
      .post("/api/evaluation-runs")
      .send(body);

    expect(response.status).toBe(400);
  });

  it("lists users with their roles", async () => {
    const users: User[] = [
      {
        id: ADMIN_ID,
        name: "Demo Admin",
        email: "admin@example.com",
        roles: ["compliance_officer", "lawyer"],
      },
    ];
    const app = createApp(
      { users: new UserUseCases({ listUsers: async () => users }) } as AppUseCases,
      databaseReady,
    );

    const response = await request(app).get("/api/users");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(users);
  });

  describe("drafting jobs", () => {
    const pastedSource = {
      source: { kind: "text", content: "§ 21" },
      regulation: { code: "AML", title: "Zákon č. 253/2008 Sb.", kind: "law" },
    };

    it("accepts a pasted regulation with 202, the pending job and its location", async () => {
      const response = await request(createDraftingJobsApp()).post("/api/drafting-jobs").send(pastedSource);

      expect(response.status).toBe(202);
      expect(response.body).toEqual(
        expect.objectContaining({ kind: "policy_from_regulation", status: "pending", createdBy: ADMIN_ID }),
      );
      expect(response.headers.location).toBe(`/api/drafting-jobs/${response.body.id}`);
    });

    it("accepts a URL without regulation metadata", async () => {
      const response = await request(createDraftingJobsApp())
        .post("/api/drafting-jobs")
        .send({ source: { kind: "url", url: "https://eur-lex.europa.eu/eli/reg/2024/1624/oj" } });

      expect(response.status).toBe(202);
      expect(response.body).toEqual(expect.objectContaining({ sourceKind: "url", regulationId: null }));
    });

    it("rejects pasted text without a regulation", async () => {
      const response = await request(createDraftingJobsApp())
        .post("/api/drafting-jobs")
        .send({ source: pastedSource.source });

      expect(response.status).toBe(400);
    });

    it("rejects a URL outside the allowed sources with 422", async () => {
      const response = await request(createDraftingJobsApp())
        .post("/api/drafting-jobs")
        .send({ source: { kind: "url", url: "https://example.com/aml" } });

      expect(response.status).toBe(422);
    });

    it("lists jobs filtered by a comma-separated status list", async () => {
      const app = createDraftingJobsApp();
      await request(app).post("/api/drafting-jobs").send(pastedSource);

      const pending = await request(app).get("/api/drafting-jobs?status=pending,running");
      const failed = await request(app).get("/api/drafting-jobs?status=failed");

      expect(pending.body).toEqual(expect.objectContaining({ total: 1, limit: 50, offset: 0 }));
      expect(failed.body.total).toBe(0);
    });

    it("rejects an unknown status filter", async () => {
      const response = await request(createDraftingJobsApp()).get("/api/drafting-jobs?status=done");

      expect(response.status).toBe(400);
    });
  });
  describe("transactions", () => {
    const TRANSACTION: Transaction = {
      transactionId: "TX000000583",
      clientId: "K002989",
      occurredAt: new Date("2026-07-01T04:11:48Z"),
      amount: "7384.21",
      currency: "EUR",
      payerCountry: "SK",
      payeeCountry: "DK",
      payerAccount: "ASK00090",
      payeeAccount: "K002989",
      transactionType: "incoming",
      counterpartyAccount: "ASK00090",
      counterpartyCountry: "SK",
    };

    function createTransactionsApp() {
      const calls: { filter: TransactionFilter; page: PageRequest }[] = [];
      const transactions = new TransactionQueries({
        listTransactions: async (filter, page) => {
          calls.push({ filter, page });
          return { ...page, items: [TRANSACTION], total: 1 };
        },
      });

      return { app: createApp({ transactions } as AppUseCases, databaseReady), calls };
    }

    it("lists all transactions with the default page when no filter is given", async () => {
      const { app, calls } = createTransactionsApp();

      const response = await request(app).get("/api/transactions");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        items: [{ ...TRANSACTION, occurredAt: "2026-07-01T04:11:48.000Z" }],
        total: 1,
        limit: 50,
        offset: 0,
      });
      expect(calls).toEqual([
        { filter: { clientId: null, from: null, to: null }, page: { limit: 50, offset: 0 } },
      ]);
    });

    it("passes the client filter, the time window and the page", async () => {
      const { app, calls } = createTransactionsApp();

      const response = await request(app).get(
        "/api/transactions?clientId=K002989&from=2026-07-01&to=2026-07-08T12:00&limit=20&offset=40",
      );

      expect(response.status).toBe(200);
      expect(calls).toEqual([
        {
          filter: { clientId: "K002989", from: "2026-07-01T00:00:00", to: "2026-07-08T12:00:00" },
          page: { limit: 20, offset: 40 },
        },
      ]);
    });

    it.each([
      ["a malformed client ID", "clientId=K12"],
      ["a timestamp with an offset", "from=2026-07-01T00:00:00Z"],
      ["from after to", "from=2026-07-08&to=2026-07-01"],
      ["a limit over the maximum", "limit=501"],
    ])("rejects %s with 400", async (_case, query) => {
      const { app, calls } = createTransactionsApp();

      const response = await request(app).get(`/api/transactions?${query}`);

      expect(response.status).toBe(400);
      expect(calls).toEqual([]);
    });
  });
});
