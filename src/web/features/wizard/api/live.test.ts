/**
 * @jest-environment node
 */
// Node's File has text(), which the live adapter uses to read a Markdown file; jsdom's File does not.
import { CURRENT_USER } from "@/config/currentUser";
import { requestJson } from "@/lib/httpClient";

import type { DraftPoliciesInput } from "../types";
import { liveWizardService } from "./live";

// Every request is served by an in-memory fake of the backend drafting flow, never by the shared database.
jest.mock("@/lib/httpClient", () => ({ requestJson: jest.fn() }));
const requestJsonMock = jest.mocked(requestJson);

const CREATED_AT = "2026-10-19T10:00:00.000Z";
const DRAFTS_PER_SOURCE = 2;

type RecordedRequest = { method: string; path: string; jsonBody?: unknown };
type Row = Record<string, unknown> & { id: string };

function createReviewFields(status: string) {
  return {
    versionNo: 1,
    status,
    createdVia: "wizard",
    createdBy: CURRENT_USER.id,
    createdAt: CREATED_AT,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
  };
}

/** Mimics regulationsRouter, internalPoliciesRouter and rulesRouter with the DummyDraftGenerator. */
function createFakeBackend() {
  const regulations: Row[] = [
    { id: "reg-existing", code: "AMLZ", title: "AML zákon", kind: "law", sourceUrl: null, checkedAt: null },
  ];
  const regulationVersions: Row[] = [];
  const policies: Row[] = [];
  const policyVersions: Row[] = [];
  const rules: Row[] = [];
  const ruleVersions: Row[] = [];
  const requests: RecordedRequest[] = [];
  let nextId = 1;
  const createId = (prefix: string) => `${prefix}-${nextId++}`;
  const findById = (rows: Row[], id: string | undefined) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) {
      throw new Error(`Fake backend: ${id} not found`);
    }
    return row;
  };

  function draftPolicies(regulationVersionId: string): Row[] {
    return Array.from({ length: DRAFTS_PER_SOURCE }, (_, index) => {
      const policy = { id: createId("policy"), code: `SVZ-${index}`, title: `[DUMMY] Předpis ${index}` };
      const version = {
        id: createId("policy-version"),
        policyId: policy.id,
        body: `# [DUMMY] Předpis ${index}`,
        legalBases: [{ regulationVersionId, ref: "neurčeno" }],
        ...createReviewFields("draft"),
      };
      policies.push(policy);
      policyVersions.push(version);
      return version;
    });
  }

  // internalPolicyUseCases.reviewVersion: approval drafts the policy's rules.
  function draftRules(policyVersion: Row): void {
    for (let index = 0; index < DRAFTS_PER_SOURCE; index += 1) {
      const rule = {
        id: createId("rule"),
        policyId: policyVersion.policyId,
        code: `R${index}`,
        alertType: "DUMMY_LARGE_AMOUNT",
        kind: "deterministic",
        isEnabled: false,
        activeVersionId: null,
        isWhitelistAllowed: true,
        createdAt: CREATED_AT,
      };
      rules.push(rule);
      ruleVersions.push({
        id: createId("rule-version"),
        ruleId: rule.id,
        derivedFromPolicyVersionId: policyVersion.id,
        definition: { match: "any", features: ["tx_amount_czk"], conditions: [] },
        agentPrompt: null,
        agentModelId: null,
        humanText: `[DUMMY] Pravidlo ${index}`,
        thresholdRationale: null,
        baseScore: 50,
        sensitivity: 100,
        riskProfiles: ["low", "medium", "high"],
        legalBases: [{ regulationVersionId: "reg-version-x", ref: "neurčeno" }],
        ...createReviewFields("draft"),
      });
    }
  }

  function handleGet(segments: string[]): unknown {
    const [collection, id, child] = segments;
    if (collection === "regulations") {
      if (id === undefined) {
        return regulations;
      }
      return child === "versions"
        ? regulationVersions.filter((version) => version.regulationId === id)
        : findById(regulations, id);
    }
    if (collection === "internal-policies") {
      if (id === undefined) {
        return policies;
      }
      return child === "versions"
        ? policyVersions.filter((version) => version.policyId === id)
        : findById(policies, id);
    }
    if (collection === "rules") {
      if (id === undefined) {
        return rules;
      }
      return child === "versions"
        ? ruleVersions.filter((version) => version.ruleId === id)
        : findById(rules, id);
    }
    throw new Error(`Fake backend: unexpected GET /${segments.join("/")}`);
  }

  function handlePost(segments: string[], jsonBody: Record<string, unknown>): unknown {
    const [collection, id, child, versionId, action] = segments;
    if (collection === "regulations" && id === undefined) {
      const regulation = { id: createId("reg"), checkedAt: null, ...jsonBody };
      regulations.push(regulation);
      return regulation;
    }
    if (collection === "regulations" && child === "versions" && versionId === undefined) {
      findById(regulations, id);
      const version = { id: createId("reg-version"), regulationId: id, createdAt: CREATED_AT, ...jsonBody };
      regulationVersions.push(version);
      return version;
    }
    if (collection === "regulations" && action === "draft-policies") {
      return draftPolicies(findById(regulationVersions, versionId).id);
    }
    if (collection === "internal-policies" && action === "submit") {
      return Object.assign(findById(policyVersions, versionId), { status: "pending_review" });
    }
    if (collection === "internal-policies" && action === "review") {
      const version = Object.assign(findById(policyVersions, versionId), { status: jsonBody.decision });
      if (jsonBody.decision === "approved") {
        draftRules(version);
      }
      return version;
    }
    if (collection === "rules" && action === "submit") {
      return Object.assign(findById(ruleVersions, versionId), { status: "pending_review" });
    }
    throw new Error(`Fake backend: unexpected POST /${segments.join("/")}`);
  }

  requestJsonMock.mockImplementation(async ({ path, method = "GET", jsonBody }) => {
    requests.push({ method, path, jsonBody });
    const segments = path.split("?")[0]!.split("/").filter(Boolean).map(decodeURIComponent);
    return method === "GET" ? handleGet(segments) : handlePost(segments, jsonBody as Record<string, unknown>);
  });

  return {
    requests,
    ruleVersions,
    writes: () => requests.filter(({ method }) => method !== "GET"),
  };
}

const LONG_TEXT = "§ 1 Povinná osoba průběžně sleduje obchodní vztahy a transakce svých klientů.";

const NEW_REGULATION_INPUT: DraftPoliciesInput = {
  source: { kind: "text", text: LONG_TEXT },
  regulation: {
    kind: "new",
    code: "AMLZ-2026",
    title: "Zákon o AML",
    regulationKind: "law",
    sourceUrl: "https://example.org/aml",
  },
  versionLabel: "Znění k 2026-10-19",
};

describe("liveWizardService", () => {
  beforeEach(() => requestJsonMock.mockReset());

  it("cannot load a regulation from a URL (BE-02) but is available", () => {
    expect(liveWizardService.capabilities).toEqual({ isAvailable: true, canFetchUrl: false });
  });

  it("creates the regulation and its wording, then returns every policy draft", async () => {
    const backend = createFakeBackend();

    const result = await liveWizardService.draftPolicies(NEW_REGULATION_INPUT);

    expect(backend.writes()).toEqual([
      {
        method: "POST",
        path: "/regulations",
        jsonBody: {
          code: "AMLZ-2026",
          title: "Zákon o AML",
          kind: "law",
          sourceUrl: "https://example.org/aml",
        },
      },
      {
        method: "POST",
        path: "/regulations/reg-1/versions",
        jsonBody: { label: "Znění k 2026-10-19", fullText: LONG_TEXT },
      },
      {
        method: "POST",
        path: "/regulations/reg-1/versions/reg-version-2/draft-policies",
        jsonBody: { createdBy: CURRENT_USER.id },
      },
    ]);
    expect(result.regulation).toMatchObject({
      id: "reg-1",
      shortName: "AMLZ-2026",
      version: "Znění k 2026-10-19",
    });
    expect(result.policies.map(({ name, status, legalBases }) => ({ name, status, legalBases }))).toEqual([
      {
        name: "[DUMMY] Předpis 0",
        status: "draft",
        legalBases: [{ regulationId: "reg-1", ref: "neurčeno" }],
      },
      {
        name: "[DUMMY] Předpis 1",
        status: "draft",
        legalBases: [{ regulationId: "reg-1", ref: "neurčeno" }],
      },
    ]);
  });

  it("adds a wording to an existing regulation and reads a Markdown file as text", async () => {
    const backend = createFakeBackend();
    const markdownFile = new File(["# Vyhláška\n\nObsah"], "vyhlaska.md", { type: "text/markdown" });

    await liveWizardService.draftPolicies({
      source: { kind: "file", file: markdownFile },
      regulation: { kind: "existing", regulationId: "reg-existing" },
      versionLabel: "Novela 2026",
    });

    expect(backend.writes().map(({ path, jsonBody }) => ({ path, jsonBody }))).toEqual([
      {
        path: "/regulations/reg-existing/versions",
        jsonBody: { label: "Novela 2026", fullText: "# Vyhláška\n\nObsah" },
      },
      {
        path: "/regulations/reg-existing/versions/reg-version-1/draft-policies",
        jsonBody: { createdBy: CURRENT_USER.id },
      },
    ]);
  });

  it.each([
    {
      label: "a file that is not Markdown",
      input: { ...NEW_REGULATION_INPUT, source: { kind: "file", file: new File(["x"], "aml.docx") } },
    },
    {
      label: "a URL",
      input: {
        ...NEW_REGULATION_INPUT,
        source: { kind: "url", url: "https://example.org/aml" },
        regulation: { kind: "fromUrl", url: "https://example.org/aml" },
      },
    },
    {
      label: "a regulation derived from a URL",
      input: { ...NEW_REGULATION_INPUT, regulation: { kind: "fromUrl", url: "https://example.org/aml" } },
    },
  ] as const)("rejects $label as unsupported before writing anything", async ({ input }) => {
    const backend = createFakeBackend();

    await expect(liveWizardService.draftPolicies(input)).rejects.toMatchObject({
      kind: "unsupported",
    });
    expect(backend.requests).toEqual([]);
  });

  it("approves a policy draft (submit, then review) and returns the rule drafts the backend created", async () => {
    const backend = createFakeBackend();
    const { policies } = await liveWizardService.draftPolicies(NEW_REGULATION_INPUT);
    const policyId = policies[0]!.id;
    const writesBefore = backend.writes().length;

    const { policy, rules } = await liveWizardService.approvePolicyDraft(policyId);

    expect(backend.writes().slice(writesBefore)).toEqual([
      {
        method: "POST",
        path: `/internal-policies/${policyId}/versions/policy-version-4/submit`,
        jsonBody: undefined,
      },
      {
        method: "POST",
        path: `/internal-policies/${policyId}/versions/policy-version-4/review`,
        jsonBody: { decision: "approved", reviewedBy: CURRENT_USER.id, reviewComment: null },
      },
    ]);
    expect(policy.status).toBe("approved");
    expect(
      rules.map(({ policyId: rulePolicyId, status, description }) => ({ rulePolicyId, status, description })),
    ).toEqual([
      { rulePolicyId: policyId, status: "draft", description: "[DUMMY] Pravidlo 0" },
      { rulePolicyId: policyId, status: "draft", description: "[DUMMY] Pravidlo 1" },
    ]);
  });

  it("submits only the rules that are still drafts when the review is finished", async () => {
    const backend = createFakeBackend();
    const { policies } = await liveWizardService.draftPolicies(NEW_REGULATION_INPUT);
    const policyIds = policies.map((policy) => policy.id);
    const { rules } = await liveWizardService.approvePolicyDraft(policyIds[0]!);
    // The analyst already decided the first rule in the review step, so its version is no draft any more.
    Object.assign(
      backend.ruleVersions.find((version) => version.ruleId === rules[0]!.id)!,
      {
        status: "pending_review",
      },
    );
    const writesBefore = backend.writes().length;

    const finishedRules = await liveWizardService.finishRuleReview(policyIds);

    const draftVersionOfSecondRule = backend.ruleVersions.find((version) => version.ruleId === rules[1]!.id)!;
    expect(backend.writes().slice(writesBefore)).toEqual([
      {
        method: "POST",
        path: `/rules/${rules[1]!.id}/versions/${draftVersionOfSecondRule.id}/submit`,
        jsonBody: undefined,
      },
    ]);
    expect(finishedRules.map((rule) => rule.status)).toEqual(["pending_for_review", "pending_for_review"]);
  });
});
