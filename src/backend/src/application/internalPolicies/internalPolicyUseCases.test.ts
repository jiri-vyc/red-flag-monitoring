import { BusinessRuleViolationError, ConflictError } from "../errors";
import { InMemoryInternalPolicyRepository } from "../testing/InMemoryInternalPolicyRepository";
import { ADMIN_ID, fixedClock } from "../testing/fixtures";
import type { InternalPolicyVersion } from "../../domain/internalPolicy";
import { InternalPolicyUseCases } from "./internalPolicyUseCases";

const APPROVAL = { decision: "approved", reviewedBy: ADMIN_ID, reviewComment: null } as const;

async function setUp() {
  const draftedFrom: { versionId: string; createdBy: string }[] = [];
  const ruleDrafting = {
    draftRules: (version: InternalPolicyVersion, createdBy: string) => {
      draftedFrom.push({ versionId: version.id, createdBy });
      return Promise.resolve([]);
    },
  };
  const internalPolicyUseCases = new InternalPolicyUseCases(
    new InMemoryInternalPolicyRepository(),
    fixedClock,
    ruleDrafting,
  );
  const policy = await internalPolicyUseCases.createPolicy({ code: "SVZ-TM", title: "Monitoring transakcí" });

  return { internalPolicyUseCases, policy, draftedFrom };
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

  it("drafts rules from the approved version, authored by the reviewer", async () => {
    const { internalPolicyUseCases, policy, draftedFrom } = await setUp();
    const pending = await createPendingVersion(internalPolicyUseCases, policy.id);

    await internalPolicyUseCases.reviewVersion(policy.id, pending.id, APPROVAL);

    expect(draftedFrom).toEqual([{ versionId: pending.id, createdBy: ADMIN_ID }]);
  });

  it("drafts no rules from a rejected version", async () => {
    const { internalPolicyUseCases, policy, draftedFrom } = await setUp();
    const pending = await createPendingVersion(internalPolicyUseCases, policy.id);

    await internalPolicyUseCases.reviewVersion(policy.id, pending.id, {
      ...APPROVAL,
      decision: "rejected",
      reviewComment: "Chybí § 21",
    });

    expect(draftedFrom).toEqual([]);
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
