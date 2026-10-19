import { BusinessRuleViolationError, ConflictError, NotFoundError } from "../errors";
import { InMemoryRuleRepository } from "../testing/InMemoryRuleRepository";
import { ADMIN_ID, buildDeterministicVersion, fixedClock, REVIEWED_AT } from "../testing/fixtures";
import { RuleUseCases } from "./ruleUseCases";

const APPROVAL = {
  decision: "approved",
  reviewedBy: ADMIN_ID,
  reviewComment: null,
  escalationRole: null,
} as const;

async function setUp() {
  const ruleRepository = new InMemoryRuleRepository();
  const ruleUseCases = new RuleUseCases(ruleRepository, fixedClock);
  const rule = await ruleUseCases.createRule({
    policyId: null,
    code: "A",
    alertType: "unusual_amount",
    kind: "deterministic",
    isWhitelistAllowed: true,
  });

  return { ruleRepository, ruleUseCases, rule };
}

async function createApprovedVersion(ruleUseCases: RuleUseCases, ruleId: string) {
  const version = await ruleUseCases.createVersion(
    buildDeterministicVersion(ruleId, { status: "pending_review" }),
  );

  return ruleUseCases.reviewVersion(ruleId, version.id, APPROVAL);
}

describe("RuleUseCases escalation role (issue #6)", () => {
  it("keeps the version's escalation role when the review does not change it", async () => {
    const { ruleUseCases, rule } = await setUp();

    const approved = await createApprovedVersion(ruleUseCases, rule.id);

    expect(approved.escalationRole).toBe("contact_person");
  });

  it("lets the reviewer escalate the version to another role", async () => {
    const { ruleUseCases, rule } = await setUp();
    const pending = await ruleUseCases.createVersion(
      buildDeterministicVersion(rule.id, { status: "pending_review" }),
    );

    const approved = await ruleUseCases.reviewVersion(rule.id, pending.id, {
      ...APPROVAL,
      escalationRole: "designated_person",
    });

    expect(approved).toMatchObject({ status: "approved", escalationRole: "designated_person" });
  });

  it("changes the escalation role on rejection too", async () => {
    const { ruleUseCases, rule } = await setUp();
    const pending = await ruleUseCases.createVersion(
      buildDeterministicVersion(rule.id, { status: "pending_review" }),
    );

    const rejected = await ruleUseCases.reviewVersion(rule.id, pending.id, {
      ...APPROVAL,
      decision: "rejected",
      reviewComment: "Patří pověřené osobě",
      escalationRole: "designated_person",
    });

    expect(rejected).toMatchObject({ status: "rejected", escalationRole: "designated_person" });
  });
});

describe("RuleUseCases.createVersion", () => {
  it("numbers versions of a rule consecutively", async () => {
    const { ruleUseCases, rule } = await setUp();

    await ruleUseCases.createVersion(buildDeterministicVersion(rule.id));
    const second = await ruleUseCases.createVersion(buildDeterministicVersion(rule.id));

    expect(second.versionNo).toBe(2);
  });

  it("rejects a deterministic version without a definition", async () => {
    const { ruleUseCases, rule } = await setUp();

    await expect(
      ruleUseCases.createVersion(buildDeterministicVersion(rule.id, { definition: null })),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("rejects agent fields on a deterministic rule", async () => {
    const { ruleUseCases, rule } = await setUp();

    await expect(
      ruleUseCases.createVersion(
        buildDeterministicVersion(rule.id, { agentPrompt: "Assess", agentModelId: "m" }),
      ),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("rejects a version without a legal basis", async () => {
    const { ruleUseCases, rule } = await setUp();

    await expect(
      ruleUseCases.createVersion(buildDeterministicVersion(rule.id, { legalBases: [] })),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("rejects a version for an unknown rule", async () => {
    const { ruleUseCases } = await setUp();

    await expect(ruleUseCases.createVersion(buildDeterministicVersion("missing"))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("RuleUseCases review", () => {
  it("moves a draft to pending review", async () => {
    const { ruleUseCases, rule } = await setUp();
    const draft = await ruleUseCases.createVersion(buildDeterministicVersion(rule.id));

    const submitted = await ruleUseCases.submitVersionForReview(rule.id, draft.id);

    expect(submitted.status).toBe("pending_review");
  });

  it("records the reviewer and time on approval and keeps the content unchanged", async () => {
    const { ruleUseCases, rule } = await setUp();
    const pending = await ruleUseCases.createVersion(
      buildDeterministicVersion(rule.id, { status: "pending_review" }),
    );

    const approved = await ruleUseCases.reviewVersion(rule.id, pending.id, APPROVAL);

    expect(approved).toEqual({
      ...pending,
      status: "approved",
      reviewedBy: ADMIN_ID,
      reviewedAt: REVIEWED_AT,
    });
  });

  it("does not activate the approved version", async () => {
    const { ruleUseCases, rule } = await setUp();

    await createApprovedVersion(ruleUseCases, rule.id);

    expect((await ruleUseCases.getRule(rule.id)).activeVersionId).toBeNull();
  });

  it("refuses to review a draft that was not submitted", async () => {
    const { ruleUseCases, rule } = await setUp();
    const draft = await ruleUseCases.createVersion(buildDeterministicVersion(rule.id));

    await expect(ruleUseCases.reviewVersion(rule.id, draft.id, APPROVAL)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("refuses to review an already approved version again", async () => {
    const { ruleUseCases, rule } = await setUp();
    const approved = await createApprovedVersion(ruleUseCases, rule.id);

    await expect(
      ruleUseCases.reviewVersion(rule.id, approved.id, {
        ...APPROVAL,
        decision: "rejected",
        reviewComment: "No",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a rejection without a comment", async () => {
    const { ruleUseCases, rule } = await setUp();
    const pending = await ruleUseCases.createVersion(
      buildDeterministicVersion(rule.id, { status: "pending_review" }),
    );

    await expect(
      ruleUseCases.reviewVersion(rule.id, pending.id, { ...APPROVAL, decision: "rejected" }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("does not find a version through another rule", async () => {
    const { ruleUseCases, rule } = await setUp();
    const otherRule = await ruleUseCases.createRule({ ...rule, code: "B" });
    const pending = await ruleUseCases.createVersion(
      buildDeterministicVersion(rule.id, { status: "pending_review" }),
    );

    await expect(ruleUseCases.reviewVersion(otherRule.id, pending.id, APPROVAL)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("propagates repository failures", async () => {
    const { ruleRepository, ruleUseCases, rule } = await setUp();
    const pending = await ruleUseCases.createVersion(
      buildDeterministicVersion(rule.id, { status: "pending_review" }),
    );
    ruleRepository.recordReview = () => Promise.reject(new Error("connection lost"));

    await expect(ruleUseCases.reviewVersion(rule.id, pending.id, APPROVAL)).rejects.toThrow(
      "connection lost",
    );
  });
});

describe("RuleUseCases.setActiveVersion", () => {
  it("activates an approved version and supersedes the previous active one", async () => {
    const { ruleUseCases, rule } = await setUp();
    const first = await createApprovedVersion(ruleUseCases, rule.id);
    const second = await createApprovedVersion(ruleUseCases, rule.id);
    await ruleUseCases.setActiveVersion(rule.id, first.id);

    const updated = await ruleUseCases.setActiveVersion(rule.id, second.id);

    expect(updated.activeVersionId).toBe(second.id);
    expect((await ruleUseCases.getVersion(rule.id, first.id)).status).toBe("superseded");
  });

  it.each(["draft", "pending_review"] as const)("refuses to activate a %s version", async (status) => {
    const { ruleUseCases, rule } = await setUp();
    const version = await ruleUseCases.createVersion(buildDeterministicVersion(rule.id, { status }));

    await expect(ruleUseCases.setActiveVersion(rule.id, version.id)).rejects.toBeInstanceOf(
      BusinessRuleViolationError,
    );
  });

  it("refuses to activate a rejected version", async () => {
    const { ruleUseCases, rule } = await setUp();
    const pending = await ruleUseCases.createVersion(
      buildDeterministicVersion(rule.id, { status: "pending_review" }),
    );
    await ruleUseCases.reviewVersion(rule.id, pending.id, {
      ...APPROVAL,
      decision: "rejected",
      reviewComment: "No",
    });

    await expect(ruleUseCases.setActiveVersion(rule.id, pending.id)).rejects.toBeInstanceOf(
      BusinessRuleViolationError,
    );
  });

  it("refuses to reactivate a superseded version", async () => {
    const { ruleUseCases, rule } = await setUp();
    const first = await createApprovedVersion(ruleUseCases, rule.id);
    const second = await createApprovedVersion(ruleUseCases, rule.id);
    await ruleUseCases.setActiveVersion(rule.id, first.id);
    await ruleUseCases.setActiveVersion(rule.id, second.id);

    await expect(ruleUseCases.setActiveVersion(rule.id, first.id)).rejects.toBeInstanceOf(
      BusinessRuleViolationError,
    );
  });
});

describe("RuleUseCases.enableRule", () => {
  it("refuses to enable a rule without an active version", async () => {
    const { ruleUseCases, rule } = await setUp();

    await expect(ruleUseCases.enableRule(rule.id)).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("enables a rule with an active version", async () => {
    const { ruleUseCases, rule } = await setUp();
    const approved = await createApprovedVersion(ruleUseCases, rule.id);
    await ruleUseCases.setActiveVersion(rule.id, approved.id);

    const enabled = await ruleUseCases.enableRule(rule.id);

    expect(enabled.isEnabled).toBe(true);
  });
});
