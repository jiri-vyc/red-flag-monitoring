import { getCurrentUser } from "@/config/currentUser";
import { ApiError } from "@/lib/apiError";
import { requestJson } from "@/lib/httpClient";

import { ruleDefinitionDtoSchema, type RuleDto, type RuleVersionDto, type RuleWithVersionsDto } from "./dto";
import { deriveRuleStatus, liveRulesService, toRule } from "./live";

// Mutations are verified against a mocked HTTP client, never against the shared backend database.
jest.mock("@/lib/httpClient", () => ({ requestJson: jest.fn() }));
const requestJsonMock = jest.mocked(requestJson);

const CREATED_AT = "2026-10-19T10:00:00.000Z";
const REVIEWED_AT = "2026-10-19T11:00:00.000Z";

function createRuleDto(overrides: Partial<RuleDto> = {}): RuleDto {
  return {
    id: "rule-1",
    policyId: null,
    code: "A",
    alertType: "Neobvyklá transakce",
    kind: "deterministic",
    isEnabled: false,
    activeVersionId: null,
    isWhitelistAllowed: true,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function createVersionDto(overrides: Partial<RuleVersionDto> = {}): RuleVersionDto {
  return {
    id: "version-1",
    ruleId: "rule-1",
    versionNo: 1,
    status: "draft",
    createdVia: "manual",
    createdBy: getCurrentUser().id,
    createdAt: CREATED_AT,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    derivedFromPolicyVersionId: null,
    definition: { match: "any", features: [], conditions: [] },
    agentPrompt: null,
    agentModelId: null,
    humanText: "Transakce nad limitem",
    thresholdRationale: null,
    baseScore: 60,
    sensitivity: 100,
    riskProfiles: ["high"],
    escalationRole: "contact_person",
    legalBases: [{ regulationVersionId: "reg-version-1", ref: "§ 6" }],
    ...overrides,
  };
}

function withVersions(rule: RuleDto, versions: RuleVersionDto[]): RuleWithVersionsDto {
  return { rule, versions };
}

const approvedVersion = createVersionDto({
  status: "approved",
  reviewedBy: getCurrentUser().id,
  reviewedAt: REVIEWED_AT,
});
const pendingUpdate = createVersionDto({ id: "version-2", versionNo: 2, status: "pending_review" });

describe("deriveRuleStatus (M6)", () => {
  it("is draft or pending_for_review while a rule without an active version awaits review", () => {
    expect(deriveRuleStatus(withVersions(createRuleDto(), [createVersionDto()]))).toBe("draft");
    expect(
      deriveRuleStatus(withVersions(createRuleDto(), [createVersionDto({ status: "pending_review" })])),
    ).toBe("pending_for_review");
  });

  it("is update_for_review when a newer version waits next to the active one", () => {
    const rule = createRuleDto({ isEnabled: true, activeVersionId: approvedVersion.id });
    expect(deriveRuleStatus(withVersions(rule, [approvedVersion, pendingUpdate]))).toBe("update_for_review");
  });

  it("is pending_for_review, not running, when a disabled rule gets a new version", () => {
    const disabledRule = createRuleDto({ isEnabled: false, activeVersionId: approvedVersion.id });
    expect(deriveRuleStatus(withVersions(disabledRule, [approvedVersion, pendingUpdate]))).toBe(
      "pending_for_review",
    );
  });

  it("follows enabled once nothing awaits review", () => {
    const activeRule = createRuleDto({ isEnabled: true, activeVersionId: approvedVersion.id });
    expect(deriveRuleStatus(withVersions(activeRule, [approvedVersion]))).toBe("active");
    expect(deriveRuleStatus(withVersions({ ...activeRule, isEnabled: false }, [approvedVersion]))).toBe(
      "inactive",
    );
  });

  it("is inactive for an enabled flag without an active version", () => {
    const rule = createRuleDto({ isEnabled: true });
    expect(deriveRuleStatus(withVersions(rule, [createVersionDto({ status: "rejected" })]))).toBe("inactive");
  });
});

describe("toRule", () => {
  it("maps the running version, legal basis and current user to the web model", () => {
    const rule = createRuleDto({ isEnabled: true, activeVersionId: approvedVersion.id });
    const mappedRule = toRule(
      withVersions(rule, [approvedVersion, pendingUpdate]),
      new Map([["reg-version-1", "reg-1"]]),
    );

    expect(mappedRule).toMatchObject({
      name: "A · Neobvyklá transakce",
      status: "update_for_review",
      runningVersionNumber: 1,
      policyId: null,
      updatedAt: REVIEWED_AT,
    });
    expect(mappedRule.versions[0]).toMatchObject({
      state: "approved",
      createdBy: getCurrentUser().name,
      reviewedBy: getCurrentUser().name,
      content: { type: "deterministic", explanation: "Transakce nad limitem" },
      legalBases: [{ regulationId: "reg-1", ref: "§ 6" }],
    });
  });

  it("maps each version's own legal bases (M5), collapsing wordings of one regulation", () => {
    const version = createVersionDto({
      legalBases: [
        { regulationVersionId: "reg-version-1", ref: "§ 6 odst. 1 písm. b)" },
        { regulationVersionId: "reg-version-2", ref: "§ 6 odst. 1 písm. b)" },
        { regulationVersionId: "eu-version-1", ref: "čl. 18a" },
      ],
    });
    const mappedRule = toRule(
      withVersions(createRuleDto({ policyId: "policy-1" }), [version]),
      new Map([
        ["reg-version-1", "reg-1"],
        ["reg-version-2", "reg-1"],
        ["eu-version-1", "reg-eu"],
      ]),
    );

    expect(mappedRule.policyId).toBe("policy-1");
    expect(mappedRule.versions[0]?.legalBases).toEqual([
      { regulationId: "reg-1", ref: "§ 6 odst. 1 písm. b)" },
      { regulationId: "reg-eu", ref: "čl. 18a" },
    ]);
  });
});

const VALID_DEFINITION = {
  match: "any",
  features: ["amount_czk"],
  conditions: [
    { id: "c1", label: "Částka", left: { feature: "amount_czk" }, op: ">", right: { value: 1000 } },
  ],
};

type RecordedRequest = { path: string; method: string; jsonBody?: unknown };

/** Answers the GETs of one rule (and an empty regulation list) and records every request. */
function serveRule(rule: RuleDto, versions: RuleVersionDto[]): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  requestJsonMock.mockImplementation(async ({ path, method = "GET", jsonBody }) => {
    requests.push({ path, method, jsonBody });
    if (method !== "GET") {
      return versions.at(-1);
    }
    if (path === "/regulations") {
      return [];
    }
    if (path === `/rules/${rule.id}/versions`) {
      return versions;
    }
    if (path === `/rules/${rule.id}`) {
      return rule;
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  });
  return requests;
}

const writesOf = (requests: RecordedRequest[]) => requests.filter(({ method }) => method !== "GET");

const REGULATION_DTO = {
  id: "reg-1",
  code: "AMLZ",
  title: "AML zákon",
  kind: "law",
  sourceUrl: null,
  checkedAt: null,
};
const REGULATION_VERSIONS = [
  { id: "reg-1-old", regulationId: "reg-1", label: "původní znění", createdAt: "2026-01-01T00:00:00.000Z" },
  {
    id: "reg-1-new",
    regulationId: "reg-1",
    label: "znění od 11. 1. 2026",
    createdAt: "2026-01-11T00:00:00.000Z",
  },
];
const POLICY_VERSIONS = [
  { id: "policy-1-v1", status: "approved" },
  { id: "policy-1-v2", status: "draft" },
];

/** Answers the GETs and writes of creating one manual rule and records every request. */
function serveManualRuleCreation(): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  const createdRule = createRuleDto({ kind: "agentic" });
  const createdVersion = createVersionDto({
    status: "pending_review",
    definition: null,
    baseScore: null,
    agentPrompt: "Platba do rizikové země",
    agentModelId: "model",
    legalBases: [{ regulationVersionId: "reg-1-new", ref: "§ 6" }],
  });
  const endpoints: Record<string, unknown> = {
    "GET /regulations": [REGULATION_DTO],
    "GET /regulations/reg-1/versions": REGULATION_VERSIONS,
    "GET /internal-policies/policy-1/versions": POLICY_VERSIONS,
    "GET /internal-policies/policy-1": { id: "policy-1", code: "P1", title: "Předpis" },
    "POST /rules": createdRule,
    "POST /rules/rule-1/versions": createdVersion,
    "GET /rules/rule-1": createdRule,
    "GET /rules/rule-1/versions": [createdVersion],
  };
  requestJsonMock.mockImplementation(async ({ path, method = "GET", jsonBody }) => {
    requests.push({ path, method, jsonBody });
    const key = `${method} ${path}`;
    if (!(key in endpoints)) {
      throw new Error(`Unexpected request ${key}`);
    }
    return endpoints[key];
  });
  return requests;
}

const MANUAL_RULE_INPUT = {
  description: "Platba do rizikové země",
  policyId: null,
  type: "agentic" as const,
  sensitivity: 80,
  riskProfiles: ["high" as const],
  escalationRole: "contact_person" as const,
  legalBases: [{ regulationId: "reg-1", ref: " § 6 " }],
  author: getCurrentUser().name,
};

describe("liveRulesService mutations", () => {
  beforeEach(() => requestJsonMock.mockReset());

  it("sends the escalation role picked at review with the approval (issue #6)", async () => {
    const requests = serveRule(createRuleDto(), [createVersionDto({ status: "pending_review" })]);

    await liveRulesService.approveRule({
      ruleId: "rule-1",
      reviewer: getCurrentUser().name,
      escalationRole: "designated_person",
    });

    expect(writesOf(requests)).toContainEqual({
      path: "/rules/rule-1/versions/version-1/review",
      method: "POST",
      jsonBody: {
        decision: "approved",
        reviewedBy: getCurrentUser().id,
        reviewComment: null,
        escalationRole: "designated_person",
      },
    });
  });

  it("hides what the backend cannot do and keeps agentic creation", () => {
    expect(liveRulesService.capabilities).toEqual({
      canEditDraftContent: false,
      canCreateDeterministicRule: false,
      canCreateAgenticRule: true,
      canSuggestWhitelistClients: false,
    });
  });

  it("rejects a pending version with the trimmed comment as the review comment", async () => {
    const requests = serveRule(createRuleDto(), [createVersionDto({ status: "pending_review" })]);

    await liveRulesService.rejectRule({
      ruleId: "rule-1",
      reviewer: getCurrentUser().name,
      comment: "  Chybí práh  ",
      escalationRole: null,
    });

    expect(writesOf(requests)).toEqual([
      {
        path: "/rules/rule-1/versions/version-1/review",
        method: "POST",
        jsonBody: {
          decision: "rejected",
          reviewedBy: getCurrentUser().id,
          reviewComment: "Chybí práh",
          escalationRole: null,
        },
      },
    ]);
  });

  it("submits a draft before rejecting it, because the backend reviews only pending versions", async () => {
    const requests = serveRule(createRuleDto(), [createVersionDto({ status: "draft" })]);

    await liveRulesService.rejectRule({
      ruleId: "rule-1",
      reviewer: getCurrentUser().name,
      comment: "Duplicitní",
      escalationRole: null,
    });

    expect(writesOf(requests).map(({ path }) => path)).toEqual([
      "/rules/rule-1/versions/version-1/submit",
      "/rules/rule-1/versions/version-1/review",
    ]);
  });

  it("refuses a rejection without a reason before sending anything", async () => {
    serveRule(createRuleDto(), [createVersionDto({ status: "pending_review" })]);

    await expect(
      liveRulesService.rejectRule({
        ruleId: "rule-1",
        reviewer: getCurrentUser().name,
        comment: "   ",
        escalationRole: null,
      }),
    ).rejects.toMatchObject({ kind: "validation" });
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  it("creates a rule without a policy (M4) whose version cites the newest regulation wording (M5)", async () => {
    const requests = serveManualRuleCreation();

    const createdRule = await liveRulesService.createManualRule(MANUAL_RULE_INPUT);

    const [createRule, createVersion] = writesOf(requests);
    expect(createRule).toMatchObject({ path: "/rules", jsonBody: { policyId: null, kind: "agentic" } });
    expect(createVersion).toMatchObject({
      path: "/rules/rule-1/versions",
      jsonBody: {
        derivedFromPolicyVersionId: null,
        legalBases: [{ regulationVersionId: "reg-1-new", ref: "§ 6" }],
      },
    });
    expect(requests.some(({ path }) => path.startsWith("/internal-policies"))).toBe(false);
    expect(createdRule.versions[0]?.legalBases).toEqual([{ regulationId: "reg-1", ref: "§ 6" }]);
  });

  it("derives a rule with a policy from the policy's approved version and sends unique legal bases", async () => {
    const requests = serveManualRuleCreation();

    await liveRulesService.createManualRule({
      ...MANUAL_RULE_INPUT,
      policyId: "policy-1",
      legalBases: [
        { regulationId: "reg-1", ref: "§ 6" },
        { regulationId: "reg-1", ref: "§ 6 " },
      ],
    });

    expect(writesOf(requests)[1]?.jsonBody).toMatchObject({
      derivedFromPolicyVersionId: "policy-1-v1",
      legalBases: [{ regulationVersionId: "reg-1-new", ref: "§ 6" }],
    });
  });

  it("refuses a rule without a legal basis before sending anything, like the backend (M5)", async () => {
    serveManualRuleCreation();

    await expect(
      liveRulesService.createManualRule({ ...MANUAL_RULE_INPUT, legalBases: [] }),
    ).rejects.toMatchObject({ kind: "validation" });
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  it("refuses a legal basis of a regulation without any wording before creating the rule", async () => {
    const requests = serveManualRuleCreation();

    await expect(
      liveRulesService.createManualRule({
        ...MANUAL_RULE_INPUT,
        legalBases: [{ regulationId: "reg-unknown", ref: "§ 1" }],
      }),
    ).rejects.toMatchObject({ kind: "validation" });
    expect(writesOf(requests)).toEqual([]);
  });

  it("keeps a new version on the legal basis of the version it is based on", async () => {
    const rule = createRuleDto({ isEnabled: true, activeVersionId: approvedVersion.id });
    const requests = serveRule(rule, [approvedVersion]);

    await liveRulesService.createRuleVersion({
      ruleId: "rule-1",
      content: { type: "deterministic", code: JSON.stringify(VALID_DEFINITION), explanation: "Nový práh" },
      config: { sensitivity: 70, riskProfiles: ["high"], escalationRole: "contact_person" },
      changeNote: "",
      author: getCurrentUser().name,
    });

    expect(writesOf(requests)[0]?.jsonBody).toMatchObject({
      legalBases: [{ regulationVersionId: "reg-version-1", ref: "§ 6" }],
    });
  });

  it("keeps throwing unsupported for the hidden operations without calling the API", async () => {
    await expect(
      liveRulesService.createManualRule({ ...MANUAL_RULE_INPUT, type: "deterministic" }),
    ).rejects.toMatchObject({ kind: "unsupported" });
    expect(() =>
      liveRulesService.updateDraftContent({
        ruleId: "rule-1",
        content: { type: "agentic", ruleText: "Posuď transakci" },
      }),
    ).toThrow(ApiError);
    expect(requestJsonMock).not.toHaveBeenCalled();
  });
});

describe("ruleDefinitionDtoSchema", () => {
  const amountCondition = (id: string) => ({
    id,
    label: "Částka",
    left: { feature: "tx_amount_czk" },
    op: ">",
    right: { value: 1000 },
  });
  const nestedDefinition = (innerId: string) => ({
    match: "any",
    features: ["tx_amount_czk"],
    conditions: [
      amountCondition("amount"),
      { id: "group", label: "Rizikový klient", match: "all", conditions: [amountCondition(innerId)] },
    ],
  });

  it("accepts nested condition groups like the backend", () => {
    expect(ruleDefinitionDtoSchema.safeParse(nestedDefinition("inner")).success).toBe(true);
  });

  it("rejects condition ids repeated across nested groups", () => {
    const parseResult = ruleDefinitionDtoSchema.safeParse(nestedDefinition("amount"));

    expect(parseResult.success).toBe(false);
    expect(parseResult.error?.issues[0]?.message).toBe("Condition ids must be unique across nested groups");
  });

  it("rejects an empty group", () => {
    const definition = {
      ...nestedDefinition("inner"),
      conditions: [{ id: "group", label: "Prázdná", match: "all", conditions: [] }],
    };

    expect(ruleDefinitionDtoSchema.safeParse(definition).success).toBe(false);
  });
});
