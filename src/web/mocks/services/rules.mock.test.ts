import { getCurrentUser } from "@/config/currentUser";
import { canDeleteRule, getLatestVersion } from "@/features/rules/domain/ruleLifecycle";
import { ApiError } from "@/lib/apiError";

import { readMockDatabase, resetMockDatabase } from "../store/mockDatabase";
import { mockRulesService } from "./rules.mock";

jest.mock("../latency", () => ({ simulateLatency: () => Promise.resolve() }));

const deletedBy = getCurrentUser().name;

describe("mock rules deletion", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockDatabase();
  });

  it("deletes a never-approved rule together with its whitelist entries", async () => {
    const deletableRule = readMockDatabase().rules.find(
      (rule) => canDeleteRule(rule) && rule.whitelistAllowed,
    )!;
    await mockRulesService.addWhitelistEntry({
      ruleId: deletableRule.id,
      clientId: "K000123",
      reason: "Ověřený klient",
      author: deletedBy,
    });

    await mockRulesService.deleteRule({ ruleId: deletableRule.id, deletedBy });

    const database = readMockDatabase();
    expect(database.rules.some((rule) => rule.id === deletableRule.id)).toBe(false);
    expect(database.whitelistEntries.some((entry) => entry.ruleId === deletableRule.id)).toBe(false);
    expect(database.ruleCheckKinds[deletableRule.id]).toBeUndefined();
    expect(mockRulesService.capabilities.canDeleteRule).toBe(true);
  });

  it("refuses a rule that had an approved version and keeps it", async () => {
    const approvedRule = readMockDatabase().rules.find((rule) => !canDeleteRule(rule))!;

    await expect(mockRulesService.deleteRule({ ruleId: approvedRule.id, deletedBy })).rejects.toMatchObject(
      new ApiError({
        kind: "validation",
        message: `Rule "${approvedRule.id}" had an approved version and can only be switched off.`,
      }),
    );
    expect(readMockDatabase().rules.some((rule) => rule.id === approvedRule.id)).toBe(true);
  });
});

describe("mock rules draft edit", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockDatabase();
  });

  const findDraftRule = () => readMockDatabase().rules.find((rule) => rule.status === "draft")!;

  it("saves the draft version's content and config in place", async () => {
    const draftRule = findDraftRule();
    const draftVersion = getLatestVersion(draftRule);
    const config = {
      sensitivity: 42,
      riskProfiles: ["low" as const],
      escalationRole: "contact_person" as const,
    };

    await mockRulesService.updateDraftContent({
      ruleId: draftRule.id,
      content: draftVersion.content,
      config,
    });

    const savedRule = readMockDatabase().rules.find((rule) => rule.id === draftRule.id)!;
    expect(savedRule.versions).toHaveLength(draftRule.versions.length);
    expect(getLatestVersion(savedRule).config).toEqual(config);
  });

  it("keeps the draft version's config when only the content is sent", async () => {
    const draftRule = findDraftRule();
    const draftVersion = getLatestVersion(draftRule);

    await mockRulesService.updateDraftContent({ ruleId: draftRule.id, content: draftVersion.content });

    const savedRule = readMockDatabase().rules.find((rule) => rule.id === draftRule.id)!;
    expect(getLatestVersion(savedRule).config).toEqual(draftVersion.config);
  });
});
