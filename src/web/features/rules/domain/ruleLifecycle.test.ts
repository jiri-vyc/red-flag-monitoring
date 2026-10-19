import type { Rule, RuleConfig } from "../types";
import {
  addRuleVersion,
  approveRule,
  findPendingVersion,
  findRunningVersion,
  getChangedConfigFields,
  isRuleExecutable,
  rejectRule,
  RuleTransitionError,
  submitRuleForReview,
} from "./ruleLifecycle";

const NOW = "2026-10-19T10:00:00.000Z";
const REVIEW = { reviewer: "Reviewer", now: NOW };
const INITIAL_CONFIG: RuleConfig = { sensitivity: 80, riskProfiles: ["high"] };
const UPDATED_CONFIG: RuleConfig = { sensitivity: 50, riskProfiles: ["high", "medium"] };

function createDraftRule(): Rule {
  return {
    id: "rule-1",
    name: "Test rule",
    description: "",
    type: "agentic",
    status: "draft",
    origin: "manual",
    policyId: "pol-1",
    regulationId: "reg-1",
    sourceProvision: "§ 6",
    runningVersionNumber: null,
    versions: [
      {
        versionNumber: 1,
        state: "draft",
        content: { type: "agentic", ruleText: "v1" },
        config: INITIAL_CONFIG,
        changeNote: "",
        createdAt: NOW,
        createdBy: "Author",
        reviewedBy: null,
        reviewedAt: null,
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
