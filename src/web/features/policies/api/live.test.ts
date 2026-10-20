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

  it("maps the version history oldest first, with author and reviewer names (issue #5)", async () => {
    serveEndpoints();
    const fallbackImplementation = requestJsonMock.getMockImplementation()!;
    const rejectedVersion: InternalPolicyVersionDto = {
      ...MULTI_REGULATION_VERSION,
      id: "policy-multi-v1",
      status: "rejected",
      createdVia: "wizard",
      body: "Původní text",
      reviewedBy: getCurrentUser().id,
      reviewedAt: "2026-10-19T12:00:00.000Z",
      reviewComment: "Chybí práh",
    };
    const draftVersion: InternalPolicyVersionDto = {
      ...MULTI_REGULATION_VERSION,
      id: "policy-multi-v2",
      versionNo: 2,
      createdBy: "unknown-user-id",
      legalBases: [{ regulationVersionId: "decree-v1", ref: "§ 3" }],
    };
    requestJsonMock.mockImplementation(async (options) =>
      options.path === "/internal-policies/policy-multi/versions"
        ? [draftVersion, rejectedVersion]
        : fallbackImplementation(options),
    );

    const policy = await livePoliciesService.loadPolicy("policy-multi");

    expect(policy.versions).toEqual([
      {
        versionNumber: 1,
        state: "rejected",
        createdVia: "wizard",
        text: "Původní text",
        legalBases: [
          { regulationId: "reg-aml", ref: "§ 21" },
          { regulationId: "reg-decree", ref: null },
        ],
        createdBy: getCurrentUser().name,
        createdAt: CREATED_AT,
        reviewedBy: getCurrentUser().name,
        reviewedAt: "2026-10-19T12:00:00.000Z",
        reviewComment: "Chybí práh",
      },
      {
        versionNumber: 2,
        state: "draft",
        createdVia: "manual",
        text: "Text předpisu",
        legalBases: [{ regulationId: "reg-decree", ref: "§ 3" }],
        createdBy: "unknown-user-id",
        createdAt: CREATED_AT,
        reviewedBy: null,
        reviewedAt: null,
        reviewComment: null,
      },
    ]);
    expect(policy).toMatchObject({ status: "draft", text: "Text předpisu", origin: "generated" });
  });

  it("loads policy names for links with a single request", async () => {
    const requests = serveEndpoints();

    const names = await livePoliciesService.loadPolicyNames();

    expect(names).toEqual({
      "policy-multi": "Systém vnitřních zásad",
      "policy-internal": "Interní eskalace",
    });
    expect(requests.map(({ path }) => path)).toEqual(["/internal-policies"]);
  });

  describe("current version (BE-11)", () => {
    const APPROVED_AT = "2026-10-19T12:00:00.000Z";
    const REJECTED_AT = "2026-10-20T09:00:00.000Z";

    function createVersion(
      versionNo: number,
      status: InternalPolicyVersionDto["status"],
      overrides: Partial<InternalPolicyVersionDto> = {},
    ): InternalPolicyVersionDto {
      return {
        ...MULTI_REGULATION_VERSION,
        id: `policy-multi-v${versionNo}`,
        versionNo,
        status,
        body: `Text v${versionNo}`,
        ...overrides,
      };
    }

    function serveVersions(versions: InternalPolicyVersionDto[]) {
      serveEndpoints();
      const fallbackImplementation = requestJsonMock.getMockImplementation()!;
      requestJsonMock.mockImplementation(async (options) =>
        options.path === "/internal-policies/policy-multi/versions"
          ? versions
          : fallbackImplementation(options),
      );
    }

    const APPROVED_V1 = createVersion(1, "approved", {
      reviewedBy: getCurrentUser().id,
      reviewedAt: APPROVED_AT,
    });

    it("keeps the latest approved version in force when a newer one is rejected", async () => {
      serveVersions([
        APPROVED_V1,
        createVersion(2, "rejected", {
          legalBases: [{ regulationVersionId: "decree-v1", ref: "§ 3" }],
          reviewedBy: "unknown-user-id",
          reviewedAt: REJECTED_AT,
          reviewComment: "Nesouhlasí",
        }),
      ]);

      const policy = await livePoliciesService.loadPolicy("policy-multi");

      expect(policy).toMatchObject({
        status: "approved",
        text: "Text v1",
        legalBases: [
          { regulationId: "reg-aml", ref: "§ 21" },
          { regulationId: "reg-decree", ref: null },
        ],
        approvedBy: getCurrentUser().name,
        approvedAt: APPROVED_AT,
        updatedAt: REJECTED_AT,
      });
      expect(policy.versions.map(({ versionNumber, state }) => ({ versionNumber, state }))).toEqual([
        { versionNumber: 1, state: "approved" },
        { versionNumber: 2, state: "rejected" },
      ]);
    });

    it("falls back past a superseded latest version to the latest approved one", async () => {
      serveVersions([
        createVersion(1, "superseded"),
        createVersion(2, "approved", { reviewedBy: getCurrentUser().id, reviewedAt: APPROVED_AT }),
        createVersion(3, "superseded"),
      ]);

      const policy = await livePoliciesService.loadPolicy("policy-multi");

      expect(policy).toMatchObject({ status: "approved", text: "Text v2", approvedAt: APPROVED_AT });
    });

    it("shows a newer draft or pending version as the draft being worked on", async () => {
      serveVersions([APPROVED_V1, createVersion(2, "pending_review")]);

      const policy = await livePoliciesService.loadPolicy("policy-multi");

      expect(policy).toMatchObject({ status: "draft", text: "Text v2", approvedBy: null, approvedAt: null });
    });

    it("keeps a rejected policy that was never approved a draft with the rejected text", async () => {
      serveVersions([createVersion(1, "rejected", { reviewedAt: REJECTED_AT })]);

      const policy = await livePoliciesService.loadPolicy("policy-multi");

      expect(policy).toMatchObject({ status: "draft", text: "Text v1", approvedBy: null, approvedAt: null });
    });
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

  it("takes the legal bases of the version in force, not of a newer rejected one", async () => {
    const requests = serveEndpoints();
    const fallbackImplementation = requestJsonMock.getMockImplementation()!;
    const rejectedVersion = {
      ...MULTI_REGULATION_VERSION,
      id: "policy-multi-v2",
      versionNo: 2,
      status: "rejected" as const,
      legalBases: [{ regulationVersionId: "decree-v1", ref: "§ 3" }],
    };
    requestJsonMock.mockImplementation(async (options) =>
      options.path === "/internal-policies/policy-multi/versions" && (options.method ?? "GET") === "GET"
        ? [{ ...MULTI_REGULATION_VERSION, status: "approved" }, rejectedVersion]
        : fallbackImplementation(options),
    );

    await livePoliciesService.updatePolicyText({ policyId: "policy-multi", text: "Nový text" });

    const writes = requests.filter(({ method }) => method !== "GET");
    expect(writes[0]?.jsonBody).toMatchObject({ legalBases: MULTI_REGULATION_VERSION.legalBases });
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
