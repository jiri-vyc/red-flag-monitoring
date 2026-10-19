import { getCurrentUser } from "@/config/currentUser";
import type { EvaluationRunListItemDto } from "@/features/batches/api/dto";
import type { RuleDto, RuleVersionDto } from "@/features/rules/api/dto";
import { requestJson } from "@/lib/httpClient";

import { liveDashboardService } from "./live";

// The live endpoints are served by a mocked HTTP client, so the test never touches the shared backend database.
jest.mock("@/lib/httpClient", () => ({ requestJson: jest.fn() }));
const requestJsonMock = jest.mocked(requestJson);

const CREATED_AT = "2026-10-19T10:00:00.000Z";

function createRuleDto(id: string, overrides: Partial<RuleDto> = {}): RuleDto {
  return {
    id,
    policyId: "policy-1",
    code: id.toUpperCase(),
    alertType: "Neobvyklá transakce",
    kind: "deterministic",
    isEnabled: false,
    activeVersionId: null,
    isWhitelistAllowed: true,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function createVersionDto(
  ruleId: string,
  versionNo: number,
  status: RuleVersionDto["status"],
): RuleVersionDto {
  return {
    id: `${ruleId}-v${versionNo}`,
    ruleId,
    versionNo,
    status,
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
    legalBases: [{ regulationVersionId: "reg-1-v1", ref: "§ 9 odst. 2" }],
  };
}

function createRunDto(id: string): EvaluationRunListItemDto {
  return {
    id,
    status: "completed",
    scope: null,
    fileName: `${id}.csv`,
    rowsTotal: 10,
    rowsImported: 10,
    txProcessed: 10,
    txPassed: 7,
    txFlagged: 2,
    txError: 1,
    hitThreshold: 50,
    createdBy: getCurrentUser().id,
    createdAt: CREATED_AT,
    finishedAt: CREATED_AT,
    errorMessage: null,
  };
}

const RULES = [
  createRuleDto("active", { isEnabled: true, activeVersionId: "active-v1" }),
  // M4: a rule may have no policy.
  createRuleDto("pending", { policyId: null }),
  createRuleDto("update", { isEnabled: true, activeVersionId: "update-v1" }),
  createRuleDto("draft"),
];
const VERSIONS_BY_RULE_ID: Record<string, RuleVersionDto[]> = {
  active: [createVersionDto("active", 1, "approved")],
  pending: [createVersionDto("pending", 1, "pending_review")],
  update: [createVersionDto("update", 1, "approved"), createVersionDto("update", 2, "pending_review")],
  draft: [createVersionDto("draft", 1, "draft")],
};
// Newest first, as GET /evaluation-runs returns them.
const RUNS = ["run-4", "run-3", "run-2", "run-1"].map(createRunDto);

const ENDPOINTS: Record<string, unknown> = {
  "/rules": RULES,
  "/regulations": [{ id: "reg-1" }, { id: "reg-2" }],
  "/regulations/reg-1/versions": [
    { id: "reg-1-v1", regulationId: "reg-1", label: "znění 2026", createdAt: CREATED_AT },
  ],
  "/regulations/reg-2/versions": [],
  "/internal-policies": [{ id: "policy-1", code: "P1", title: "Předpis" }],
  "/evaluation-runs?limit=500": { items: RUNS, total: RUNS.length },
  ...Object.fromEntries(
    Object.entries(VERSIONS_BY_RULE_ID).map(([ruleId, versions]) => [`/rules/${ruleId}/versions`, versions]),
  ),
};

describe("liveDashboardService", () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
    requestJsonMock.mockImplementation(async ({ path, method = "GET" }) => {
      if (method !== "GET" || !(path in ENDPOINTS)) {
        throw new Error(`Unexpected request ${method} ${path}`);
      }
      return ENDPOINTS[path];
    });
  });

  it("composes the summary from the live rules, regulations, policies and evaluation runs", async () => {
    const summary = await liveDashboardService.loadDashboardSummary();

    expect(summary).toMatchObject({
      activeRuleCount: 1,
      rulesAwaitingReviewCount: 2,
      regulationCount: 2,
      policyCount: 1,
    });
    expect(summary.rulesNeedingReview.map(({ id, status }) => [id, status])).toEqual([
      ["pending", "pending_for_review"],
      ["update", "update_for_review"],
    ]);
    // The review list shows each rule's legal basis, mapped from the regulation wording to the regulation.
    expect(summary.rulesNeedingReview[0]).toMatchObject({ policyId: null });
    expect(summary.rulesNeedingReview[0]?.versions[0]?.legalBases).toEqual([
      { regulationId: "reg-1", ref: "§ 9 odst. 2" },
    ]);
    expect(summary.recentBatches.map(({ id }) => id)).toEqual(["run-4", "run-3", "run-2"]);
    expect(summary.recentBatches[0]?.counts).toEqual({ ok: 7, to_check: 1, alert: 2 });
  });

  it("reads only, and does not load policy versions just to count policies", async () => {
    await liveDashboardService.loadDashboardSummary();

    const requestedPaths = requestJsonMock.mock.calls.map(([options]) => options.path);
    expect(requestJsonMock.mock.calls.every(([options]) => (options.method ?? "GET") === "GET")).toBe(true);
    expect(requestedPaths.some((path) => path.startsWith("/internal-policies/"))).toBe(false);
  });
});
