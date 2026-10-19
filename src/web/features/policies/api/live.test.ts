import { getCurrentUser } from "@/config/currentUser";
import { createDraftingJobDto } from "@/features/draftingJobs/api/draftingJobDtoFixture";
import { requestJson } from "@/lib/httpClient";

import type { InternalPolicyVersionDto } from "./dto";
import { livePoliciesService } from "./live";

// GETs and writes are served by a mocked HTTP client, never by the shared backend database.
jest.mock("@/lib/httpClient", () => ({ requestJson: jest.fn() }));
const requestJsonMock = jest.mocked(requestJson);

const CREATED_AT = "2026-10-19T10:00:00.000Z";

function createPolicyVersionDto(
  policyId: string,
  legalBases: InternalPolicyVersionDto["legalBases"],
): InternalPolicyVersionDto {
  return {
    id: `${policyId}-v1`,
    policyId,
    versionNo: 1,
    status: "draft",
    createdVia: "manual",
    createdBy: getCurrentUser().id,
    createdAt: CREATED_AT,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    body: "Text předpisu",
    legalBases,
  };
}

const MULTI_REGULATION_VERSION = createPolicyVersionDto("policy-multi", [
  { regulationVersionId: "aml-v1", ref: "§ 21" },
  { regulationVersionId: "decree-v1", ref: null },
]);

const ENDPOINTS: Record<string, unknown> = {
  "GET /internal-policies": [
    { id: "policy-multi", code: "SVZ", title: "Systém vnitřních zásad" },
    { id: "policy-internal", code: "INT", title: "Interní eskalace" },
  ],
  "GET /internal-policies/policy-multi/versions": [MULTI_REGULATION_VERSION],
  "GET /internal-policies/policy-internal/versions": [createPolicyVersionDto("policy-internal", [])],
  "GET /rules": [
    { id: "rule-1", policyId: "policy-multi" },
    { id: "rule-2", policyId: null },
  ],
  "GET /regulations": [{ id: "reg-aml" }, { id: "reg-decree" }],
  "GET /regulations/reg-aml/versions": [
    { id: "aml-v1", regulationId: "reg-aml", label: "znění 2026", createdAt: CREATED_AT },
  ],
  "GET /regulations/reg-decree/versions": [
    { id: "decree-v1", regulationId: "reg-decree", label: "znění 2018", createdAt: CREATED_AT },
  ],
  "POST /internal-policies/policy-multi/versions": MULTI_REGULATION_VERSION,
  "GET /internal-policies/policy-multi": { id: "policy-multi", code: "SVZ", title: "Systém vnitřních zásad" },
};

function serveEndpoints(): { path: string; method: string; jsonBody?: unknown }[] {
  const requests: { path: string; method: string; jsonBody?: unknown }[] = [];
  requestJsonMock.mockImplementation(async ({ path, method = "GET", jsonBody }) => {
    requests.push({ path, method, jsonBody });
    const key = `${method} ${path}`;
    if (!(key in ENDPOINTS)) {
      throw new Error(`Unexpected request ${key}`);
    }
    return ENDPOINTS[key];
  });
  return requests;
}

describe("livePoliciesService", () => {
  beforeEach(() => requestJsonMock.mockReset());

  it("maps all cited regulations with refs (M3), and a purely internal policy to none", async () => {
    serveEndpoints();

    const policies = await livePoliciesService.loadPolicies();

    expect(policies.map(({ id, legalBases, ruleIds }) => ({ id, legalBases, ruleIds }))).toEqual([
      {
        id: "policy-multi",
        legalBases: [
          { regulationId: "reg-aml", ref: "§ 21" },
          { regulationId: "reg-decree", ref: null },
        ],
        ruleIds: ["rule-1"],
      },
      { id: "policy-internal", legalBases: [], ruleIds: [] },
    ]);
  });

  it("saves an edited text as a new draft version that keeps the legal bases", async () => {
    const requests = serveEndpoints();

    await livePoliciesService.updatePolicyText({ policyId: "policy-multi", text: "Nový text" });

    const writes = requests.filter(({ method }) => method !== "GET");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.jsonBody).toMatchObject({
      status: "draft",
      body: "Nový text",
      legalBases: MULTI_REGULATION_VERSION.legalBases,
    });
  });
});

describe("livePoliciesService.approvePolicy", () => {
  beforeEach(() => requestJsonMock.mockReset());

  it("submits and approves the draft, and returns the job that drafts its rules", async () => {
    const requests = serveEndpoints();
    const fallbackImplementation = requestJsonMock.getMockImplementation()!;
    const rulesJob = createDraftingJobDto({
      id: "job-rules",
      kind: "rules_from_policy",
      parentJobId: "job-policy",
      policyVersionId: "policy-multi-v1",
    });
    requestJsonMock.mockImplementation(async (options) => {
      const { path, method = "GET" } = options;
      if (method === "POST" && path.endsWith("/submit")) {
        requests.push({ path, method });
        return { ...MULTI_REGULATION_VERSION, status: "pending_review" };
      }
      if (method === "POST" && path.endsWith("/review")) {
        requests.push({ path, method, jsonBody: options.jsonBody });
        return { ...MULTI_REGULATION_VERSION, status: "approved", rulesJob };
      }
      return fallbackImplementation(options);
    });

    const approval = await livePoliciesService.approvePolicy({
      policyId: "policy-multi",
      approvedBy: getCurrentUser().name,
    });

    const writes = requests.filter(({ method }) => method !== "GET");
    expect(writes.map(({ path }) => path)).toEqual([
      "/internal-policies/policy-multi/versions/policy-multi-v1/submit",
      "/internal-policies/policy-multi/versions/policy-multi-v1/review",
    ]);
    expect(writes[1]?.jsonBody).toEqual({
      decision: "approved",
      reviewedBy: getCurrentUser().id,
      reviewComment: null,
    });
    expect(approval.policy.id).toBe("policy-multi");
    expect(approval.rulesJob).toMatchObject({
      id: "job-rules",
      kind: "rules_from_policy",
      status: "pending",
      parentJobId: "job-policy",
      ruleIds: [],
    });
  });
});
