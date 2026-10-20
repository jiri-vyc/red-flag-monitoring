import request from "supertest";

import { RuleReviewUseCases } from "../../application/ruleReviews/ruleReviewUseCases";
import { InMemoryRuleReviewReportStore } from "../../application/testing/InMemoryRuleReviewReportStore";
import { ADMIN_ID, fixedClock } from "../../application/testing/fixtures";
import { createFakeRuleReviewInputRepository } from "../../application/testing/ruleReviewFixtures";
import { type AppUseCases, createApp } from "./createApp";

function createRuleReviewsApp() {
  const ruleReviews = new RuleReviewUseCases({
    reportStore: new InMemoryRuleReviewReportStore(),
    inputRepository: createFakeRuleReviewInputRepository(),
    launcher: { launchReview: () => Promise.resolve() },
    clock: fixedClock,
    engineVersion: "test",
    isLlmAvailable: false,
  });

  return createApp({ ruleReviews } as AppUseCases, async () => undefined);
}

describe("rule reviews API", () => {
  it("starts a review with 202 and refuses a second one with 409", async () => {
    const app = createRuleReviewsApp();

    const started = await request(app).post("/api/rule-reviews").send({});
    const second = await request(app).post("/api/rule-reviews").send({});

    expect(started.status).toBe(202);
    expect(started.body).toMatchObject({ status: "running", createdBy: ADMIN_ID, findings: [] });
    expect(second.status).toBe(409);
  });

  it("lists reviews and returns one report", async () => {
    const app = createRuleReviewsApp();
    const { body: started } = await request(app).post("/api/rule-reviews").send({ llm: false });

    const list = await request(app).get("/api/rule-reviews");
    const detail = await request(app).get(`/api/rule-reviews/${started.id}`);

    expect(list.body).toEqual([expect.objectContaining({ id: started.id, status: "running" })]);
    expect(detail.body).toMatchObject({ id: started.id, params: { llm: { enabled: false } } });
  });

  it("validates the review id and the body", async () => {
    const app = createRuleReviewsApp();

    expect((await request(app).get("/api/rule-reviews/../etc")).status).toBe(404);
    expect((await request(app).get("/api/rule-reviews/not-a-uuid")).status).toBe(400);
    expect((await request(app).post("/api/rule-reviews").send({ evaluationRunId: "x" })).status).toBe(400);
    expect((await request(app).get("/api/rule-reviews/00000000-0000-4000-8000-00000000ffff")).status).toBe(
      404,
    );
  });
});
