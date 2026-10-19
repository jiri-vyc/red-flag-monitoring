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

  it("keeps business rule violations as validation errors", async () => {
    respondWith(422, { error: "A rejected review needs a comment" });

    await expect(requestJson({ path: "/rules", schema: z.unknown() })).rejects.toMatchObject({
      kind: "validation",
      status: 422,
    });
  });
});
