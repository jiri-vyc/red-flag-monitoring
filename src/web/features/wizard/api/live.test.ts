/**
 * @jest-environment node
 */
// Node's File has text(), which the live adapter uses to read a Markdown file; jsdom's File does not.
import { CURRENT_USER } from "@/config/currentUser";
import { createDraftingJobDto } from "@/features/draftingJobs/api/draftingJobDtoFixture";
import type { DraftingJobDto } from "@/features/draftingJobs/api/dto";
import { liveDraftingJobsService } from "@/features/draftingJobs/api/live";
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

/** Mimics the drafting jobs API, internalPoliciesRouter and rulesRouter; the test plays the worker. */
function createFakeBackend() {
  const regulations: Row[] = [
    { id: "reg-existing", code: "AMLZ", title: "AML zákon", kind: "law", sourceUrl: null, checkedAt: null },
  ];
  const regulationVersions: Row[] = [];
  const policies: Row[] = [];
  const policyVersions: Row[] = [];
  const rules: Row[] = [];
  const ruleVersions: Row[] = [];
  const jobs: DraftingJobDto[] = [];
  const requests: RecordedRequest[] = [];
  let nextId = 1;
  const createId = (prefix: string) => `${prefix}-${nextId++}`;
  const findById = <TRow extends { id: string }>(rows: TRow[], id: string | undefined) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) {
      throw new Error(`Fake backend: ${id} not found`);
    }
    return row;
  };

  function draftPolicies(job: DraftingJobDto): void {
    job.policyVersions = Array.from({ length: DRAFTS_PER_SOURCE }, (_, index) => {
      const policy = { id: createId("policy"), code: `SVZ-${index}`, title: `[DUMMY] Předpis ${index}` };
      const version = {
        id: createId("policy-version"),
        policyId: policy.id,
        body: `# [DUMMY] Předpis ${index}`,
        legalBases: [{ regulationVersionId: job.regulationVersionId, ref: "neurčeno" }],
        ...createReviewFields("draft"),
      };
      policies.push(policy);
      policyVersions.push(version);
      return { id: version.id, policyId: policy.id, status: "draft" };
    });
  }

  function draftRules(job: DraftingJobDto): void {
    const policyVersion = findById(policyVersions, job.policyVersionId ?? undefined);
    job.ruleVersions = Array.from({ length: DRAFTS_PER_SOURCE }, (_, index) => {
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
      const version = {
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
      };
      rules.push(rule);
      ruleVersions.push(version);
      return { id: version.id, ruleId: rule.id, status: "draft" };
    });
  }

  function runJob(jobId: string): void {
    const job = findById(jobs, jobId);
    if (job.kind === "policy_from_regulation") {
      draftPolicies(job);
    } else {
      draftRules(job);
    }
    Object.assign(job, { status: "succeeded", attempts: 1, startedAt: CREATED_AT, finishedAt: CREATED_AT });
  }

  function createPolicyJob(jsonBody: Record<string, unknown>): DraftingJobDto {
    const source = jsonBody.source as { kind: string; content?: string; url?: string };
    const regulationBody = jsonBody.regulation as Record<string, unknown> | undefined;
    let regulationId: string | null = null;
    if (regulationBody && "id" in regulationBody) {
      regulationId = findById(regulations, regulationBody.id as string).id;
    } else if (regulationBody) {
      regulationId = createId("reg");
      regulations.push({ id: regulationId, checkedAt: null, ...regulationBody });
    }
    let regulationVersionId: string | null = null;
    if (source.kind !== "url" && regulationId) {
      regulationVersionId = createId("reg-version");
      regulationVersions.push({
        id: regulationVersionId,
        regulationId,
        label: jsonBody.versionLabel,
        fullText: source.content,
        createdAt: CREATED_AT,
      });
    }
    const job = createDraftingJobDto({
      id: createId("job"),
      sourceKind: source.kind as DraftingJobDto["sourceKind"],
      sourceUrl: source.url ?? null,
      regulationId,
      regulationVersionId,
      createdBy: jsonBody.createdBy as string,
    });
    jobs.push(job);
    return job;
  }

  function createRulesJob(policyVersion: Row): DraftingJobDto {
    const parentJob = jobs.find((job) => job.policyVersions.some(({ id }) => id === policyVersion.id));
    const job = createDraftingJobDto({
      id: createId("job"),
      kind: "rules_from_policy",
      parentJobId: parentJob?.id ?? null,
      sourceKind: null,
      regulationId: parentJob?.regulationId ?? null,
      regulationVersionId: null,
      policyVersionId: policyVersion.id,
    });
    jobs.push(job);
    return job;
  }

  function listJobs(query: URLSearchParams) {
    const kinds = query.get("kind")?.split(",");
    const policyVersionId = query.get("policyVersionId");
    const limit = Number(query.get("limit") ?? 50);
    const items = jobs
      .filter((job) => !kinds || kinds.includes(job.kind))
      .filter((job) => !policyVersionId || job.policyVersionId === policyVersionId)
      .toReversed();
    return { items: items.slice(0, limit), total: items.length, limit, offset: 0 };
  }

  function handleGet(segments: string[], query: URLSearchParams): unknown {
    const [collection, id, child] = segments;
    if (collection === "drafting-jobs") {
      return id === undefined ? listJobs(query) : findById(jobs, id);
    }
    const tables: Record<string, [Row[], Row[], string]> = {
      regulations: [regulations, regulationVersions, "regulationId"],
      "internal-policies": [policies, policyVersions, "policyId"],
      rules: [rules, ruleVersions, "ruleId"],
    };
    const table = collection === undefined ? undefined : tables[collection];
    if (!table) {
      throw new Error(`Fake backend: unexpected GET /${segments.join("/")}`);
    }
    const [rows, versions, foreignKey] = table;
    if (id === undefined) {
      return rows;
    }
    return child === "versions"
      ? versions.filter((version) => version[foreignKey] === id)
      : findById(rows, id);
  }

  function handlePost(segments: string[], jsonBody: Record<string, unknown>): unknown {
    const [collection, id, child, versionId, action] = segments;
    if (collection === "drafting-jobs" && id === undefined) {
      return createPolicyJob(jsonBody);
    }
    if (collection === "internal-policies" && action === "submit") {
      return Object.assign(findById(policyVersions, versionId), { status: "pending_review" });
    }
    if (collection === "internal-policies" && action === "review") {
      const version = Object.assign(findById(policyVersions, versionId), { status: jsonBody.decision });
      return { ...version, rulesJob: jsonBody.decision === "approved" ? createRulesJob(version) : null };
    }
    if (collection === "rules" && action === "submit") {
      return Object.assign(findById(ruleVersions, versionId), { status: "pending_review" });
    }
    throw new Error(`Fake backend: unexpected POST /${segments.join("/")} (${child ?? ""})`);
  }

  requestJsonMock.mockImplementation(async ({ path, method = "GET", jsonBody }) => {
    requests.push({ method, path, jsonBody });
    const [pathname = "", queryString = ""] = path.split("?");
    const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
    return method === "GET"
      ? handleGet(segments, new URLSearchParams(queryString))
      : handlePost(segments, jsonBody as Record<string, unknown>);
  });

  return {
    requests,
    ruleVersions,
    runJob,
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

async function draftPolicies(backend: ReturnType<typeof createFakeBackend>) {
  const { id } = await liveWizardService.startPolicyDrafting(NEW_REGULATION_INPUT);
  backend.runJob(id);
  return liveWizardService.loadPolicyDraft(await liveDraftingJobsService.loadJob(id));
}

describe("liveWizardService", () => {
  beforeEach(() => requestJsonMock.mockReset());

  it("is available and loads a regulation from a URL through a drafting job", () => {
    expect(liveWizardService.capabilities).toEqual({ isAvailable: true, canFetchUrl: true });
  });

  it("starts one policy job with the pasted text and the new regulation's metadata", async () => {
    const backend = createFakeBackend();

    const job = await liveWizardService.startPolicyDrafting(NEW_REGULATION_INPUT);

    expect(backend.writes()).toEqual([
      {
        method: "POST",
        path: "/drafting-jobs",
        jsonBody: {
          source: { kind: "text", content: LONG_TEXT },
          regulation: {
            code: "AMLZ-2026",
            title: "Zákon o AML",
            kind: "law",
            sourceUrl: "https://example.org/aml",
          },
          versionLabel: "Znění k 2026-10-19",
          createdBy: CURRENT_USER.id,
        },
      },
    ]);
    expect(job).toMatchObject({
      kind: "policy_from_regulation",
      status: "pending",
      sourceKind: "text",
      regulationId: "reg-1",
      policyIds: [],
    });
  });

  it("sends a Markdown file as its text and an existing regulation by id", async () => {
    const backend = createFakeBackend();
    const markdownFile = new File(["# Vyhláška\n\nObsah\n"], "vyhlaska.md", { type: "text/markdown" });

    await liveWizardService.startPolicyDrafting({
      source: { kind: "file", file: markdownFile },
      regulation: { kind: "existing", regulationId: "reg-existing" },
      versionLabel: "Novela 2026",
    });

    expect(backend.writes().map(({ jsonBody }) => jsonBody)).toEqual([
      {
        source: { kind: "markdown", content: "# Vyhláška\n\nObsah" },
        regulation: { id: "reg-existing" },
        versionLabel: "Novela 2026",
        createdBy: CURRENT_USER.id,
      },
    ]);
  });

  it("leaves the regulation to the job when it is derived from the URL", async () => {
    const backend = createFakeBackend();
    const url = "https://eur-lex.europa.eu/eli/reg/2024/1624/oj";

    const job = await liveWizardService.startPolicyDrafting({
      source: { kind: "url", url },
      regulation: { kind: "fromUrl", url },
      versionLabel: "Znění k 2026-10-19",
    });

    const [write] = backend.writes();
    expect(write?.jsonBody).toEqual({
      source: { kind: "url", url },
      versionLabel: "Znění k 2026-10-19",
      createdBy: CURRENT_USER.id,
    });
    expect(job).toMatchObject({ sourceKind: "url", sourceUrl: url, regulationId: null });
  });

  it.each([
    {
      label: "a file that is not Markdown",
      input: { ...NEW_REGULATION_INPUT, source: { kind: "file", file: new File(["x"], "aml.docx") } },
      kind: "unsupported",
    },
    {
      label: "an empty Markdown file",
      input: { ...NEW_REGULATION_INPUT, source: { kind: "file", file: new File(["  "], "aml.md") } },
      kind: "validation",
    },
    {
      label: "a regulation derived from a URL with a pasted text",
      input: { ...NEW_REGULATION_INPUT, regulation: { kind: "fromUrl", url: "https://example.org/aml" } },
      kind: "validation",
    },
  ] as const)("rejects $label before creating a job", async ({ input, kind }) => {
    const backend = createFakeBackend();

    await expect(liveWizardService.startPolicyDrafting(input)).rejects.toMatchObject({ kind });
    expect(backend.requests).toEqual([]);
  });

  it("loads the regulation and every policy a succeeded job drafted", async () => {
    const backend = createFakeBackend();

    const { regulation, policies } = await draftPolicies(backend);

    expect(regulation).toMatchObject({ id: "reg-1", shortName: "AMLZ-2026", version: "Znění k 2026-10-19" });
    expect(policies.map(({ name, status, legalBases }) => ({ name, status, legalBases }))).toEqual([
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

  it("rejects a succeeded job without a regulation instead of loading nothing", async () => {
    createFakeBackend();
    const job = {
      ...(await liveWizardService.startPolicyDrafting(NEW_REGULATION_INPUT)),
      regulationId: null,
    };

    await expect(liveWizardService.loadPolicyDraft(job)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("approves a policy draft and finds the rules job by the approved version", async () => {
    const backend = createFakeBackend();
    const { policies } = await draftPolicies(backend);
    const policyId = policies[0]!.id;
    const writesBefore = backend.writes().length;

    const { policy, rulesJob } = await liveWizardService.approvePolicyDraft(policyId);
    const foundJobs = await liveWizardService.findRulesJobs([policyId, policies[1]!.id]);

    expect(
      backend
        .writes()
        .slice(writesBefore)
        .map(({ path }) => path),
    ).toEqual([
      `/internal-policies/${policyId}/versions/policy-version-5/submit`,
      `/internal-policies/${policyId}/versions/policy-version-5/review`,
    ]);
    expect(policy.status).toBe("approved");
    expect(rulesJob).toMatchObject({ kind: "rules_from_policy", status: "pending", parentJobId: "job-3" });
    expect(foundJobs.map((job) => job.id)).toEqual([rulesJob!.id]);
    expect(backend.requests.map(({ path }) => path)).toContain(
      "/drafting-jobs?kind=rules_from_policy&policyVersionId=policy-version-5&limit=1",
    );
  });

  it("loads the rules a rules job drafted", async () => {
    const backend = createFakeBackend();
    const { policies } = await draftPolicies(backend);
    const policyId = policies[0]!.id;
    const { rulesJob } = await liveWizardService.approvePolicyDraft(policyId);
    backend.runJob(rulesJob!.id);

    const rules = await liveWizardService.loadDraftedRules([policyId]);

    expect(
      rules.map(({ policyId: rulePolicyId, status, description }) => ({ rulePolicyId, status, description })),
    ).toEqual([
      { rulePolicyId: policyId, status: "draft", description: "[DUMMY] Pravidlo 0" },
      { rulePolicyId: policyId, status: "draft", description: "[DUMMY] Pravidlo 1" },
    ]);
  });

  it("submits only the rules that are still drafts when the review is finished", async () => {
    const backend = createFakeBackend();
    const { policies } = await draftPolicies(backend);
    const policyIds = policies.map((policy) => policy.id);
    const { rulesJob } = await liveWizardService.approvePolicyDraft(policyIds[0]!);
    backend.runJob(rulesJob!.id);
    const rules = await liveWizardService.loadDraftedRules(policyIds);
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
