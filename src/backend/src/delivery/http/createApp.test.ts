import request from "supertest";

import { createApp } from "./createApp";

describe("HTTP app", () => {
  it("reports health", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns 404 for unknown routes", async () => {
    const response = await request(createApp()).get("/api/unknown");

    expect(response.status).toBe(404);
  });
});
