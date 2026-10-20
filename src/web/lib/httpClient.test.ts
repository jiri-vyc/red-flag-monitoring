import { z } from "zod";

import { requestJson } from "./httpClient";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function respondWith(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    statusText: "",
    json: () => Promise.resolve(body),
  });
}

describe("requestJson", () => {
  it("maps 501 (endpoint without implementation) to the unsupported kind", async () => {
    respondWith(501, { error: "The evaluation engine is not implemented yet" });

    await expect(
      requestJson({ path: "/evaluation-runs", method: "POST", schema: z.unknown() }),
    ).rejects.toMatchObject({
      kind: "unsupported",
      status: 501,
      message: expect.stringContaining("not implemented"),
    });
  });

  it("lists the validation issues of a 400 as `field: message` (issue paths may hold numbers)", async () => {
    respondWith(400, {
      error: "Invalid request",
      issues: [
        {
          code: "too_small",
          path: ["legalBases", 0, "ref"],
          message: "Too small: expected string to have >=1 characters",
        },
        {
          code: "invalid_type",
          path: ["createdBy"],
          message: "Invalid input: expected string, received undefined",
        },
        { code: "custom", path: [], message: "Body must be an object" },
      ],
    });

    await expect(requestJson({ path: "/rules", method: "POST", schema: z.unknown() })).rejects.toMatchObject({
      kind: "validation",
      status: 400,
      message:
        "Backend responded 400  for /api/rules: Invalid request: " +
        "legalBases.0.ref: Too small: expected string to have >=1 characters; " +
        "createdBy: Invalid input: expected string, received undefined; " +
        "Body must be an object",
    });
  });

  it("keeps the error message when the issues are missing or malformed", async () => {
    respondWith(400, { error: "Invalid request", issues: "not a list" });

    await expect(requestJson({ path: "/rules", schema: z.unknown() })).rejects.toMatchObject({
      message: "Backend responded 400  for /api/rules: Invalid request",
    });

    respondWith(400, { error: "Malformed JSON body" });

    await expect(requestJson({ path: "/rules", schema: z.unknown() })).rejects.toMatchObject({
      message: "Backend responded 400  for /api/rules: Malformed JSON body",
    });
  });

  it("keeps the valid issues when some of them are malformed", async () => {
    respondWith(400, {
      error: "Invalid request",
      issues: [
        { path: ["createdBy"], message: "Required" },
        { path: ["body"] },
        "not an issue",
        { message: "Body must be an object" },
      ],
    });

    await expect(requestJson({ path: "/rules", schema: z.unknown() })).rejects.toMatchObject({
      message:
        "Backend responded 400  for /api/rules: Invalid request: createdBy: Required; Body must be an object",
    });
  });

  it("keeps business rule violations as validation errors", async () => {
    respondWith(422, { error: "A rejected review needs a comment" });

    await expect(requestJson({ path: "/rules", schema: z.unknown() })).rejects.toMatchObject({
      kind: "validation",
      status: 422,
    });
  });
});
