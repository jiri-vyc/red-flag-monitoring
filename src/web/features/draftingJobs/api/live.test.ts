import { requestJson } from "@/lib/httpClient";

import { createDraftingJobDto } from "./draftingJobDtoFixture";
import { liveDraftingJobsService } from "./live";

// Every request is served by a mocked HTTP client, never by the shared backend database.
jest.mock("@/lib/httpClient", () => ({ requestJson: jest.fn() }));
const requestJsonMock = jest.mocked(requestJson);

describe("liveDraftingJobsService", () => {
  beforeEach(() => requestJsonMock.mockReset());

  it("polls every 5 s", () => {
    expect(liveDraftingJobsService.pollIntervalMs).toBe(5_000);
  });

  it("sends status and kind filters as comma-separated lists", async () => {
    requestJsonMock.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

    await liveDraftingJobsService.loadJobs({
      statuses: ["pending", "running"],
      kinds: ["policy_from_regulation"],
      limit: 20,
    });
    await liveDraftingJobsService.loadJobs({ statuses: [] });

    expect(requestJsonMock.mock.calls.map(([options]) => options.path)).toEqual([
      "/drafting-jobs?status=pending%2Crunning&kind=policy_from_regulation&limit=20",
      "/drafting-jobs",
    ]);
  });

  it("maps the drafted versions to the policies and rules they belong to, with the warnings", async () => {
    requestJsonMock.mockResolvedValue(
      createDraftingJobDto({
        status: "succeeded",
        warnings: ["Rule draft R-X was skipped: invalid definition"],
        policyVersions: [
          { id: "pv-1", policyId: "policy-1", status: "draft" },
          { id: "pv-2", policyId: "policy-1", status: "draft" },
          { id: "pv-3", policyId: "policy-2", status: "draft" },
        ],
      }),
    );

    const job = await liveDraftingJobsService.loadJob("job/1");

    expect(requestJsonMock.mock.calls[0]?.[0].path).toBe("/drafting-jobs/job%2F1");
    expect(job).toMatchObject({
      status: "succeeded",
      policyIds: ["policy-1", "policy-2"],
      ruleIds: [],
      warnings: ["Rule draft R-X was skipped: invalid definition"],
    });
  });

  it("retries a job with a POST that returns the new job", async () => {
    requestJsonMock.mockResolvedValue(createDraftingJobDto({ id: "job-2" }));

    const job = await liveDraftingJobsService.retryJob("job-1");

    expect(requestJsonMock.mock.calls[0]?.[0]).toMatchObject({
      path: "/drafting-jobs/job-1/retry",
      method: "POST",
    });
    expect(job.id).toBe("job-2");
  });
});
