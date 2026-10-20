import { getCurrentUser } from "@/config/currentUser";
import { findWizardRunJobId } from "@/features/draftingJobs/types";
import { resumeWizardRun } from "@/features/wizard/wizardRun";

import { readMockDatabase, resetMockDatabase, writeMockDatabase } from "../store/mockDatabase";
import { addMockDraftingJob, mockDraftingJobsService } from "./draftingJobs.mock";
import { mockPoliciesService } from "./policies.mock";
import { mockRegulationsService } from "./regulations.mock";
import { mockWizardService } from "./wizard.mock";

jest.mock("../latency", () => ({ simulateLatency: () => Promise.resolve() }));

const deletedBy = getCurrentUser().name;
const REGULATION_ID = "reg-wizard-run";
const POLICY_ID = "pol-wizard-run";
const services = { wizard: mockWizardService, draftingJobs: mockDraftingJobsService };

/** A finished wizard run that drafted one policy citing a regulation nothing else cites. */
function seedFinishedWizardRun(): string {
  const database = readMockDatabase();
  const draftPolicy = database.policies.find((policy) => policy.status === "draft")!;
  const legalBases = [{ regulationId: REGULATION_ID, ref: null }];
  const { database: withJob, job } = addMockDraftingJob(
    {
      ...database,
      regulations: [...database.regulations, { ...database.regulations[0]!, id: REGULATION_ID }],
      policies: [
        ...database.policies,
        {
          ...draftPolicy,
          id: POLICY_ID,
          legalBases,
          versions: draftPolicy.versions.map((version) => ({ ...version, legalBases })),
        },
      ],
    },
    {
      parentJobId: null,
      sourceKind: "text",
      sourceUrl: null,
      regulationId: REGULATION_ID,
      input: { kind: "policy_from_regulation", sourceLabel: "Text" },
    },
  );
  const finishedJob = { ...job, status: "succeeded" as const, policyIds: [POLICY_ID] };
  writeMockDatabase({
    ...withJob,
    draftingJobs: withJob.draftingJobs.map((record) =>
      record.job.id === job.id ? { ...record, job: finishedJob } : record,
    ),
  });
  return job.id;
}

describe("wizard run after its drafts are deleted (mock)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockDatabase();
  });

  it("resumes the run while its policy draft exists", async () => {
    const jobId = seedFinishedWizardRun();

    await expect(resumeWizardRun(jobId, services)).resolves.toMatchObject({ step: "policy" });
  });

  it("drops the deleted policy from the job, hides its resume link and does not crash on resume", async () => {
    const jobId = seedFinishedWizardRun();

    await mockPoliciesService.deletePolicy({ policyId: POLICY_ID, deletedBy });

    const job = await mockDraftingJobsService.loadJob(jobId);
    expect(job.policyIds).toEqual([]);
    expect(findWizardRunJobId(job)).toBeNull();
    await expect(resumeWizardRun(jobId, services)).resolves.toEqual({
      step: "unavailable",
      policyJobId: jobId,
    });
  });

  it("does not crash on resume once the policy and then its regulation are deleted", async () => {
    const jobId = seedFinishedWizardRun();

    await mockPoliciesService.deletePolicy({ policyId: POLICY_ID, deletedBy });
    await mockRegulationsService.deleteRegulation({ regulationId: REGULATION_ID, deletedBy });

    await expect(resumeWizardRun(jobId, services)).resolves.toEqual({
      step: "unavailable",
      policyJobId: jobId,
    });
  });

  it("does not crash on resume when the job still lists a policy whose regulation is gone", async () => {
    const jobId = seedFinishedWizardRun();
    const database = readMockDatabase();
    writeMockDatabase({
      ...database,
      regulations: database.regulations.filter((regulation) => regulation.id !== REGULATION_ID),
    });

    await expect(resumeWizardRun(jobId, services)).resolves.toEqual({
      step: "unavailable",
      policyJobId: jobId,
    });
  });
});
