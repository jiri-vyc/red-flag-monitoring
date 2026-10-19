import type { DraftingJob } from "../../domain/draftingJob";
import { BusinessRuleViolationError, ConflictError } from "../errors";
import { InMemoryInternalPolicyRepository } from "../testing/InMemoryInternalPolicyRepository";
import { ADMIN_ID, fixedClock } from "../testing/fixtures";
import { InternalPolicyUseCases } from "./internalPolicyUseCases";

const APPROVAL = { decision: "approved", reviewedBy: ADMIN_ID, reviewComment: null } as const;
const POLICY_JOB_ID = "policy-job-1";

async function setUp() {
  const internalPolicyRepository = new InMemoryInternalPolicyRepository();
  const launchedJobIds: string[] = [];
  const ruleDrafting = {
    findPolicyJobIdForPolicy: () => Promise.resolve(POLICY_JOB_ID),
    launchStoredJob: (jobId: string) => {
      launchedJobIds.push(jobId);
      return Promise.resolve({ id: jobId, status: "pending" } as DraftingJob);
    },
  };
  const internalPolicyUseCases = new InternalPolicyUseCases(
    internalPolicyRepository,
    fixedClock,
    ruleDrafting,
  );
  const policy = await internalPolicyUseCases.createPolicy({ code: "SVZ-TM", title: "Monitoring transakcí" });

  return {
    internalPolicyUseCases,
    policy,
    createdRulesJobs: internalPolicyRepository.createdRulesJobs,
    launchedJobIds,
  };
}

async function createPendingVersion(internalPolicyUseCases: InternalPolicyUseCases, policyId: string) {
  return internalPolicyUseCases.createVersion({
    policyId,
    body: "# Monitoring",
    status: "pending_review",
    createdVia: "manual",
    createdBy: ADMIN_ID,
    legalBases: [],
  });
}

describe("InternalPolicyUseCases.reviewVersion", () => {
  it("supersedes the previously approved version when a newer one is approved", async () => {
    const { internalPolicyUseCases, policy } = await setUp();
    const first = await createPendingVersion(internalPolicyUseCases, policy.id);
    await internalPolicyUseCases.reviewVersion(policy.id, first.id, APPROVAL);
    const second = await createPendingVersion(internalPolicyUseCases, policy.id);

    await internalPolicyUseCases.reviewVersion(policy.id, second.id, APPROVAL);

    expect((await internalPolicyUseCases.getVersion(policy.id, first.id)).status).toBe("superseded");
    expect((await internalPolicyUseCases.getVersion(policy.id, second.id)).status).toBe("approved");
  });

  it("stores a rule drafting job with the approval, authored by the reviewer, and launches it", async () => {
    const { internalPolicyUseCases, policy, createdRulesJobs, launchedJobIds } = await setUp();
    const pending = await createPendingVersion(internalPolicyUseCases, policy.id);

    const reviewed = await internalPolicyUseCases.reviewVersion(policy.id, pending.id, APPROVAL);

    expect(createdRulesJobs).toEqual([
      expect.objectContaining({
        kind: "rules_from_policy",
        policyVersionId: pending.id,
        parentJobId: POLICY_JOB_ID,
        createdBy: ADMIN_ID,
      }),
    ]);
    expect(launchedJobIds).toEqual([createdRulesJobs[0]?.id]);
    expect(reviewed.rulesJob?.id).toBe(createdRulesJobs[0]?.id);
  });

  it("drafts no rules from a rejected version", async () => {
    const { internalPolicyUseCases, policy, createdRulesJobs } = await setUp();
    const pending = await createPendingVersion(internalPolicyUseCases, policy.id);

    await internalPolicyUseCases.reviewVersion(policy.id, pending.id, {
      ...APPROVAL,
      decision: "rejected",
      reviewComment: "Chybí § 21",
    });

    expect(createdRulesJobs).toEqual([]);
  });

  it("keeps the approved version when a newer one is rejected", async () => {
    const { internalPolicyUseCases, policy } = await setUp();
    const first = await createPendingVersion(internalPolicyUseCases, policy.id);
    await internalPolicyUseCases.reviewVersion(policy.id, first.id, APPROVAL);
    const second = await createPendingVersion(internalPolicyUseCases, policy.id);

    await internalPolicyUseCases.reviewVersion(policy.id, second.id, {
      ...APPROVAL,
      decision: "rejected",
      reviewComment: "Chybí § 21",
    });

    expect((await internalPolicyUseCases.getVersion(policy.id, first.id)).status).toBe("approved");
  });

  it("refuses a rejection without a comment", async () => {
    const { internalPolicyUseCases, policy } = await setUp();
    const pending = await createPendingVersion(internalPolicyUseCases, policy.id);

    await expect(
      internalPolicyUseCases.reviewVersion(policy.id, pending.id, { ...APPROVAL, decision: "rejected" }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("refuses to submit a version that is already under review", async () => {
    const { internalPolicyUseCases, policy } = await setUp();
    const pending = await createPendingVersion(internalPolicyUseCases, policy.id);

    await expect(internalPolicyUseCases.submitVersionForReview(policy.id, pending.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
