import type { Rule, RuleConfig } from "../types";
import {
  addRuleVersion,
  approveRule,
  findPendingVersion,
  findRuleLegalBases,
  findRunningVersion,
  getChangedConfigFields,
  getLatestVersion,
  isRuleExecutable,
  rejectRule,
  RuleTransitionError,
  submitRuleForReview,
} from "./ruleLifecycle";

const NOW = "2026-10-19T10:00:00.000Z";
const REVIEW = { reviewer: "Reviewer", now: NOW, escalationRole: null };
const INITIAL_CONFIG: RuleConfig = {
  sensitivity: 80,
  riskProfiles: ["high"],
  escalationRole: "contact_person",
};
const UPDATED_CONFIG: RuleConfig = {
  sensitivity: 50,
  riskProfiles: ["high", "medium"],
  escalationRole: "contact_person",
};
const INITIAL_LEGAL_BASES = [{ regulationId: "reg-1", ref: "§ 6 odst. 1 písm. b)" }];

function createDraftRule(): Rule {
  return {
    id: "rule-1",
    name: "Test rule",
    description: "",
    type: "agentic",
    status: "draft",
    origin: "manual",
    policyId: null,
    runningVersionNumber: null,
    versions: [
      {
        versionNumber: 1,
        state: "draft",
        content: { type: "agentic", ruleText: "v1" },
        config: INITIAL_CONFIG,
        baseScore: null,
        changeNote: "",
        createdAt: NOW,
        createdBy: "Author",
        reviewedBy: null,
        reviewedAt: null,
        legalBases: INITIAL_LEGAL_BASES,
      },
    ],
    whitelistAllowed: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("rule lifecycle", () => {
  it("does not execute a rule before approval", () => {
    const pendingRule = submitRuleForReview(createDraftRule(), NOW);

    expect(pendingRule.status).toBe("pending_for_review");
    expect(isRuleExecutable(pendingRule)).toBe(false);
  });

  it("lets the review escalate the version to another role (issue #6)", () => {
    const activeRule = approveRule(createDraftRule(), { ...REVIEW, escalationRole: "designated_person" });

    expect(activeRule.versions[0]?.config.escalationRole).toBe("designated_person");
  });

  it("keeps the version's escalation role when the review does not change it", () => {
    const rejectedRule = rejectRule(createDraftRule(), REVIEW);

    expect(rejectedRule.versions[0]?.config.escalationRole).toBe("contact_person");
  });

  it("activates the approved version and records the reviewer", () => {
    const activeRule = approveRule(createDraftRule(), REVIEW);

    expect(activeRule.status).toBe("active");
    expect(activeRule.runningVersionNumber).toBe(1);
    expect(activeRule.versions[0]?.reviewedBy).toBe("Reviewer");
  });

  it("keeps the previous approved version running while an update awaits review", () => {
    const activeRule = approveRule(createDraftRule(), REVIEW);
    const updatedRule = addRuleVersion(activeRule, {
      content: { type: "agentic", ruleText: "v2" },
      config: UPDATED_CONFIG,
      changeNote: "change",
      author: "Author",
      now: NOW,
    });

    expect(updatedRule.status).toBe("update_for_review");
    expect(updatedRule.runningVersionNumber).toBe(1);
    expect(isRuleExecutable(updatedRule)).toBe(true);
  });

  it("makes the new version current when an update is approved", () => {
    const activeRule = approveRule(createDraftRule(), REVIEW);
    const updatedRule = addRuleVersion(activeRule, {
      content: { type: "agentic", ruleText: "v2" },
      config: UPDATED_CONFIG,
      changeNote: "change",
      author: "Author",
      now: NOW,
    });
    const approvedUpdate = approveRule(updatedRule, REVIEW);

    expect(approvedUpdate.runningVersionNumber).toBe(2);
    expect(approvedUpdate.versions[0]?.state).toBe("superseded");
  });

  it("keeps the rule active with the old version when an update is rejected", () => {
    const activeRule = approveRule(createDraftRule(), REVIEW);
    const updatedRule = addRuleVersion(activeRule, {
      content: { type: "agentic", ruleText: "v2" },
      config: UPDATED_CONFIG,
      changeNote: "change",
      author: "Author",
      now: NOW,
    });
    const rejectedUpdate = rejectRule(updatedRule, REVIEW);

    expect(rejectedUpdate.status).toBe("active");
    expect(rejectedUpdate.runningVersionNumber).toBe(1);
  });

  it("keeps running the approved config while a config change awaits review", () => {
    const activeRule = approveRule(createDraftRule(), REVIEW);
    const updatedRule = addRuleVersion(activeRule, {
      content: { type: "agentic", ruleText: "v1" },
      config: UPDATED_CONFIG,
      changeNote: "config only",
      author: "Author",
      now: NOW,
    });

    expect(updatedRule.status).toBe("update_for_review");
    expect(findRunningVersion(updatedRule)?.config).toEqual(INITIAL_CONFIG);
    expect(findPendingVersion(updatedRule)?.config).toEqual(UPDATED_CONFIG);
  });

  it("runs the new config once the update is approved", () => {
    const activeRule = approveRule(createDraftRule(), REVIEW);
    const updatedRule = addRuleVersion(activeRule, {
      content: { type: "agentic", ruleText: "v1" },
      config: UPDATED_CONFIG,
      changeNote: "config only",
      author: "Author",
      now: NOW,
    });
    const approvedUpdate = approveRule(updatedRule, REVIEW);

    expect(findRunningVersion(approvedUpdate)?.config).toEqual(UPDATED_CONFIG);
    expect(findPendingVersion(approvedUpdate)).toBeNull();
  });

  it("sends a new version of an inactive rule to review", () => {
    const inactiveRule = rejectRule(createDraftRule(), REVIEW);
    const updatedRule = addRuleVersion(inactiveRule, {
      content: { type: "agentic", ruleText: "v2" },
      config: UPDATED_CONFIG,
      changeNote: "retry",
      author: "Author",
      now: NOW,
    });

    expect(updatedRule.status).toBe("pending_for_review");
    expect(isRuleExecutable(updatedRule)).toBe(false);
  });

  it("takes the rule's legal basis from the running version, else the newest one (M5)", () => {
    const draftRule = createDraftRule();
    expect(findRuleLegalBases(draftRule)).toEqual(INITIAL_LEGAL_BASES);

    const activeRule = approveRule(draftRule, REVIEW);
    const ruleWithNewBasis: typeof activeRule = {
      ...activeRule,
      versions: [
        ...activeRule.versions,
        {
          ...getLatestVersion(activeRule),
          versionNumber: 2,
          state: "pending_review",
          legalBases: [{ regulationId: "reg-2", ref: "čl. 18a" }],
        },
      ],
      status: "update_for_review",
    };
    expect(findRuleLegalBases(ruleWithNewBasis)).toEqual(INITIAL_LEGAL_BASES);
    expect(findRuleLegalBases(approveRule(ruleWithNewBasis, REVIEW))).toEqual([
      { regulationId: "reg-2", ref: "čl. 18a" },
    ]);
  });

  it("keeps the legal basis of the base version on a new version", () => {
    const updatedRule = addRuleVersion(approveRule(createDraftRule(), REVIEW), {
      content: { type: "agentic", ruleText: "v2" },
      config: UPDATED_CONFIG,
      changeNote: "change",
      author: "Author",
      now: NOW,
    });

    expect(updatedRule.versions[1]?.legalBases).toEqual(INITIAL_LEGAL_BASES);
  });

  it("lists config fields that differ, ignoring list order", () => {
    expect(getChangedConfigFields(INITIAL_CONFIG, UPDATED_CONFIG)).toEqual(["sensitivity", "riskProfiles"]);
    expect(
      getChangedConfigFields({ ...UPDATED_CONFIG, riskProfiles: ["medium", "high"] }, UPDATED_CONFIG),
    ).toEqual([]);
  });

  it("rejects transitions that the status does not allow", () => {
    expect(() =>
      addRuleVersion(createDraftRule(), {
        content: { type: "agentic", ruleText: "v2" },
        config: UPDATED_CONFIG,
        changeNote: "",
        author: "Author",
        now: NOW,
      }),
    ).toThrow(RuleTransitionError);
  });
});
