import { readMockDatabase, resetMockDatabase, writeMockDatabase } from "../store/mockDatabase";
import { addMockDraftingJob, advanceMockDraftingJobs, mockDraftingJobsService } from "./draftingJobs.mock";

jest.mock("../latency", () => ({ simulateLatency: () => Promise.resolve() }));

const SECOND_MS = 1_000;

function enqueuePolicyJob(regulationId: string) {
  const { database, job } = addMockDraftingJob(readMockDatabase(), {
    parentJobId: null,
    sourceKind: "text",
    sourceUrl: null,
    regulationId,
    input: { kind: "policy_from_regulation", sourceLabel: "Vložený text regulace" },
  });
  writeMockDatabase(database);
  return job;
}

const findJob = (jobId: string, nowMs: number) =>
  advanceMockDraftingJobs(nowMs).draftingJobs.find(({ job }) => job.id === jobId)!.job;

describe("mock drafting jobs", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockDatabase();
  });

  it("goes from pending through running to succeeded within a few seconds and drafts a policy", () => {
    const regulationId = readMockDatabase().regulations[0]!.id;
    const job = enqueuePolicyJob(regulationId);
    const createdAtMs = Date.parse(job.createdAt);
    const policyCountBefore = readMockDatabase().policies.length;

    expect(findJob(job.id, createdAtMs).status).toBe("pending");
    expect(findJob(job.id, createdAtMs + 2 * SECOND_MS)).toMatchObject({ status: "running", attempts: 1 });
    const finishedJob = findJob(job.id, createdAtMs + 10 * SECOND_MS);

    expect(finishedJob).toMatchObject({ status: "succeeded", policyIds: [expect.any(String)] });
    expect(readMockDatabase().policies).toHaveLength(policyCountBefore + 1);
    expect(readMockDatabase().policies.at(-1)).toMatchObject({
      id: finishedJob.policyIds[0],
      status: "draft",
      legalBases: [{ regulationId }],
    });
  });

  it("drafts the output only once, however often the job is read", () => {
    const job = enqueuePolicyJob(readMockDatabase().regulations[0]!.id);
    const policyCountBefore = readMockDatabase().policies.length;
    const laterMs = Date.parse(job.createdAt) + 10 * SECOND_MS;

    findJob(job.id, laterMs);
    findJob(job.id, laterMs + SECOND_MS);

    expect(readMockDatabase().policies).toHaveLength(policyCountBefore + 1);
  });

  it("fails a job whose regulation is gone, and a retry starts a new job with the same inputs", async () => {
    const job = enqueuePolicyJob("reg-missing");
    const failedJob = findJob(job.id, Date.parse(job.createdAt) + 10 * SECOND_MS);
    expect(failedJob).toMatchObject({
      status: "failed",
      errorMessage: expect.stringContaining("reg-missing"),
    });

    const retriedJob = await mockDraftingJobsService.retryJob(job.id);

    expect(retriedJob).toMatchObject({
      status: "pending",
      kind: "policy_from_regulation",
      regulationId: "reg-missing",
    });
    expect(retriedJob.id).not.toBe(job.id);
    await expect(mockDraftingJobsService.retryJob(retriedJob.id)).rejects.toMatchObject({
      kind: "validation",
    });
  });

  it("lists jobs newest first, filtered by status", async () => {
    const regulationId = readMockDatabase().regulations[0]!.id;
    const olderJob = enqueuePolicyJob(regulationId);
    const newerJob = enqueuePolicyJob("reg-missing");

    const allJobs = await mockDraftingJobsService.loadJobs({});
    const inFlightJobs = await mockDraftingJobsService.loadJobs({ statuses: ["pending", "running"] });
    const failedJobs = await mockDraftingJobsService.loadJobs({ statuses: ["failed"] });

    expect(allJobs.items.map((job) => job.id)).toEqual([newerJob.id, olderJob.id]);
    expect(inFlightJobs.total).toBe(2);
    expect(failedJobs.items).toEqual([]);
  });
});
