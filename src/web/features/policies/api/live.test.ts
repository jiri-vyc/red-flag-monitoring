import { CURRENT_USER } from "@/config/currentUser";
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
    createdBy: CURRENT_USER.id,
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

  it("submits and approves the draft, and reports the rules the backend drafted on approval", async () => {
    const requests = serveEndpoints();
    const rulesBeforeApproval = ENDPOINTS["GET /rules"];
    const fallbackImplementation = requestJsonMock.getMockImplementation()!;
    let isApproved = false;
    requestJsonMock.mockImplementation(async (options) => {
      const { path, method = "GET" } = options;
      if (method === "POST" && path.endsWith("/submit")) {
        requests.push({ path, method });
        return { ...MULTI_REGULATION_VERSION, status: "pending_review" };
      }
      if (method === "POST" && path.endsWith("/review")) {
        requests.push({ path, method, jsonBody: options.jsonBody });
        isApproved = true;
        return { ...MULTI_REGULATION_VERSION, status: "approved" };
      }
      if (method === "GET" && path === "/rules" && isApproved) {
        requests.push({ path, method });
        return [...(rulesBeforeApproval as object[]), { id: "rule-drafted", policyId: "policy-multi" }];
      }
      return fallbackImplementation(options);
    });

    const { policy, draftedRuleIds } = await livePoliciesService.approvePolicy({
      policyId: "policy-multi",
      approvedBy: CURRENT_USER.name,
    });

    const writes = requests.filter(({ method }) => method !== "GET");
    expect(writes.map(({ path }) => path)).toEqual([
      "/internal-policies/policy-multi/versions/policy-multi-v1/submit",
      "/internal-policies/policy-multi/versions/policy-multi-v1/review",
    ]);
    expect(writes[1]?.jsonBody).toEqual({
      decision: "approved",
      reviewedBy: CURRENT_USER.id,
      reviewComment: null,
    });
    expect(policy.ruleIds).toEqual(["rule-1", "rule-drafted"]);
    expect(draftedRuleIds).toEqual(["rule-drafted"]);
  });
});
