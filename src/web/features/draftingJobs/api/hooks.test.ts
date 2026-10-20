import { toDraftingJob } from "./dto";
import { createDraftingJobDto } from "./draftingJobDtoFixture";
import { findDraftingJobsRefetchInterval } from "./hooks";

const POLL_INTERVAL_MS = 5_000;

const jobWithStatus = (status: "pending" | "running" | "succeeded" | "failed") =>
  toDraftingJob(createDraftingJobDto({ status }));

describe("findDraftingJobsRefetchInterval", () => {
  it.each(["pending", "running"] as const)("polls while a job is %s", (status) => {
    expect(
      findDraftingJobsRefetchInterval([jobWithStatus("succeeded"), jobWithStatus(status)], POLL_INTERVAL_MS),
    ).toBe(POLL_INTERVAL_MS);
  });

  it("stops once every job has finished", () => {
    expect(
      findDraftingJobsRefetchInterval(
        [jobWithStatus("succeeded"), jobWithStatus("failed")],
        POLL_INTERVAL_MS,
      ),
    ).toBe(false);
  });

  it("does not poll before the first answer or for an empty list", () => {
    expect(findDraftingJobsRefetchInterval(undefined, POLL_INTERVAL_MS)).toBe(false);
    expect(findDraftingJobsRefetchInterval([], POLL_INTERVAL_MS)).toBe(false);
  });
});
