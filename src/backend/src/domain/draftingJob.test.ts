import { DRAFTING_JOB_TIMEOUT_MS, type DraftingJob, reportTimedOutJob } from "./draftingJob";

const CREATED_AT = new Date("2026-10-19T10:00:00Z");

function buildJob(overrides: Partial<DraftingJob>): DraftingJob {
  return {
    id: "job-1",
    kind: "policy_from_regulation",
    status: "pending",
    parentJobId: null,
    sourceKind: "text",
    sourceUrl: null,
    scope: null,
    versionLabel: null,
    regulationId: "regulation-1",
    regulationVersionId: "regulation-version-1",
    policyVersionId: null,
    policyVersions: [],
    ruleVersions: [],
    warnings: [],
    errorMessage: null,
    attempts: 0,
    createdBy: "user-1",
    createdAt: CREATED_AT,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

const after = (milliseconds: number) => new Date(CREATED_AT.getTime() + milliseconds);

describe("reportTimedOutJob", () => {
  it("keeps an unfinished job within the timeout", () => {
    const job = buildJob({ status: "running", startedAt: CREATED_AT });

    expect(reportTimedOutJob(job, after(DRAFTING_JOB_TIMEOUT_MS - 1))).toBe(job);
  });

  it("reports a running job past the timeout as failed", () => {
    const job = buildJob({ status: "running", startedAt: CREATED_AT });

    expect(reportTimedOutJob(job, after(DRAFTING_JOB_TIMEOUT_MS))).toEqual(
      expect.objectContaining({ status: "failed", errorMessage: "The job did not finish within 16 minutes" }),
    );
  });

  it("measures a job that never started from its creation", () => {
    expect(reportTimedOutJob(buildJob({}), after(DRAFTING_JOB_TIMEOUT_MS)).status).toBe("failed");
  });

  it("keeps a finished job however old", () => {
    const job = buildJob({ status: "succeeded", finishedAt: CREATED_AT });

    expect(reportTimedOutJob(job, after(10 * DRAFTING_JOB_TIMEOUT_MS))).toBe(job);
  });
});
