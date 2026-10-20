import { createDraftingJobDto } from "@/features/draftingJobs/api/draftingJobDtoFixture";
import { toDraftingJob, type DraftingJobDto } from "@/features/draftingJobs/api/dto";
import type { DraftingJob } from "@/features/draftingJobs/types";
import type { Policy } from "@/features/policies/types";
import type { Regulation } from "@/features/regulations/types";
import { ApiError } from "@/lib/apiError";

import { resumeWizardRun } from "./wizardRun";

const createJob = (overrides: Partial<DraftingJobDto>) => toDraftingJob(createDraftingJobDto(overrides));

const POLICY_JOB = createJob({
  id: "job-policy",
  status: "succeeded",
  policyVersions: [
    { id: "pv-a", policyId: "policy-a", status: "draft" },
    { id: "pv-b", policyId: "policy-b", status: "draft" },
  ],
});
const RULES_JOB = createJob({ id: "job-rules", kind: "rules_from_policy", parentJobId: "job-policy" });

function createPolicy(id: string, status: Policy["status"]): Policy {
  return {
    id,
    name: id,
    legalBases: [],
    status,
    origin: "generated",
    text: "",
    createdAt: "",
    updatedAt: "",
    approvedBy: null,
    approvedAt: null,
    ruleIds: [],
    versions: [],
  };
}

function createServices(jobs: DraftingJob[], policyStatuses: Record<string, Policy["status"]>) {
  const findRulesJobs = jest.fn(async (policyIds: string[]) =>
    policyIds.includes("policy-a") ? [RULES_JOB] : [],
  );
  return {
    findRulesJobs,
    services: {
      draftingJobs: {
        loadJob: async (jobId: string) =>
          jobs.find((job) => job.id === jobId) ?? Promise.reject(new Error(jobId)),
      },
      wizard: {
        loadPolicyDraft: async (job: DraftingJob) => ({
          regulation: { id: job.regulationId } as Regulation,
          policies: job.policyIds.map((policyId) =>
            createPolicy(policyId, policyStatuses[policyId] ?? "draft"),
          ),
        }),
        findRulesJobs,
      },
    },
  };
}

describe("resumeWizardRun", () => {
  it("waits for a policy job that has not finished, also after a failure", async () => {
    for (const status of ["pending", "running", "failed"] as const) {
      const policyJob = createJob({ id: "job-policy", status });
      const { services } = createServices([policyJob], {});

      await expect(resumeWizardRun("job-policy", services)).resolves.toEqual({
        step: "drafting",
        policyJobId: "job-policy",
      });
    }
  });

  it("opens the policy drafts until every policy is approved, keeping the rules jobs of approved ones", async () => {
    const { services, findRulesJobs } = createServices([POLICY_JOB], { "policy-a": "approved" });

    const run = await resumeWizardRun("job-policy", services);

    expect(run).toMatchObject({
      step: "policy",
      approvedPolicyIds: ["policy-a"],
      rulesJobIds: ["job-rules"],
    });
    expect(findRulesJobs).toHaveBeenCalledWith(["policy-a"]);
  });

  it("waits for the rules once every policy is approved, also when opened from a rules job", async () => {
    const { services } = createServices([POLICY_JOB, RULES_JOB], {
      "policy-a": "approved",
      "policy-b": "approved",
    });

    const run = await resumeWizardRun("job-rules", services);

    expect(run).toMatchObject({ step: "rules", policyJobId: "job-policy", rulesJobIds: ["job-rules"] });
  });

  it("reopens the policy step for a run whose remaining drafts were skipped", async () => {
    const policyJob = createJob({
      id: "job-policy",
      status: "succeeded",
      policyVersions: [
        { id: "pv-a", policyId: "policy-a", status: "approved" },
        { id: "pv-b", policyId: "policy-b", status: "draft" },
      ],
    });
    const { services } = createServices([policyJob, RULES_JOB], { "policy-a": "approved" });

    const run = await resumeWizardRun("job-rules", services);

    expect(run).toMatchObject({
      step: "policy",
      policyJobId: "job-policy",
      approvedPolicyIds: ["policy-a"],
      rulesJobIds: ["job-rules"],
    });
  });

  it("does not look for rules jobs while nothing is approved", async () => {
    const { services, findRulesJobs } = createServices([POLICY_JOB], {});

    await expect(resumeWizardRun("job-policy", services)).resolves.toMatchObject({
      step: "policy",
      approvedPolicyIds: [],
      rulesJobIds: [],
    });
    expect(findRulesJobs).not.toHaveBeenCalled();
  });

  it("cannot continue a run whose policy drafts were all deleted", async () => {
    const emptiedPolicyJob = { ...POLICY_JOB, policyIds: [] };
    const { services } = createServices([emptiedPolicyJob], {});

    await expect(resumeWizardRun("job-policy", services)).resolves.toEqual({
      step: "unavailable",
      policyJobId: "job-policy",
    });
  });

  it("cannot continue a run whose policy draft or regulation is missing", async () => {
    const { services } = createServices([POLICY_JOB], {});
    const loadPolicyDraft = jest.fn(async () => {
      throw new ApiError({ kind: "not_found", message: "Regulation not found" });
    });

    await expect(
      resumeWizardRun("job-policy", { ...services, wizard: { ...services.wizard, loadPolicyDraft } }),
    ).resolves.toEqual({ step: "unavailable", policyJobId: "job-policy" });
  });

  it("still fails on other errors while loading the drafts", async () => {
    const { services } = createServices([POLICY_JOB], {});
    const loadPolicyDraft = jest.fn(async () => {
      throw new ApiError({ kind: "network", message: "offline" });
    });

    await expect(
      resumeWizardRun("job-policy", { ...services, wizard: { ...services.wizard, loadPolicyDraft } }),
    ).rejects.toMatchObject({ kind: "network" });
  });

  it("rejects a rules job that no wizard run started", async () => {
    const orphanRulesJob = createJob({ id: "job-orphan", kind: "rules_from_policy", parentJobId: null });
    const { services } = createServices([orphanRulesJob], {});

    await expect(resumeWizardRun("job-orphan", services)).rejects.toMatchObject({ kind: "validation" });
  });
});
