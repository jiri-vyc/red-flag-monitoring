import type { PolicyLegalBasis } from "../../domain/regulation";
import { InMemoryDraftingJobRepository } from "../testing/InMemoryDraftingJobRepository";
import { InMemoryInternalPolicyRepository } from "../testing/InMemoryInternalPolicyRepository";
import { InMemoryRegulationRepository } from "../testing/InMemoryRegulationRepository";
import { InMemoryRuleRepository } from "../testing/InMemoryRuleRepository";
import { ADMIN_ID, buildDeterministicVersion, fixedClock, REVIEWED_AT } from "../testing/fixtures";
import type { DraftGenerator, PolicyDraft, RuleDraft } from "./draftGenerator";
import { DraftingJobExecutor } from "./draftingJobExecutor";
import type { FetchedRegulationSource } from "./draftingJobPorts";
import { newRulesFromPolicyJob } from "./draftingJobPorts";

const SOURCE_URL = "https://eur-lex.europa.eu/eli/reg/2024/1624/oj";

function buildRuleDraft(overrides: Partial<RuleDraft> = {}): RuleDraft {
  const version = buildDeterministicVersion("unused");

  return {
    code: "R-DRAFT",
    alertType: "unusual_amount",
    kind: "deterministic",
    isWhitelistAllowed: true,
    definition: version.definition,
    agentPrompt: null,
    agentModelId: null,
    baseScore: version.baseScore,
    humanText: version.humanText,
    thresholdRationale: null,
    sensitivity: version.sensitivity,
    riskProfiles: version.riskProfiles,
    legalBases: version.legalBases,
    ...overrides,
  };
}

function createGenerator(
  overrides: Partial<DraftGenerator> = {},
): DraftGenerator & { scopes: (string | null)[] } {
  const scopes: (string | null)[] = [];

  return {
    scopes,
    draftPolicies: (regulation, version, scope) => {
      scopes.push(scope);
      const draft: PolicyDraft = {
        code: `${regulation.code}-SVZ`,
        title: "Monitoring transakcí",
        body: "# Monitoring",
        legalBases: [{ regulationVersionId: version.id, ref: "§ 21" }],
      };
      return Promise.resolve([draft]);
    },
    draftRules: () => Promise.resolve([buildRuleDraft()]),
    ...overrides,
  };
}

function setUp(
  generator = createGenerator(),
  fetchSource: (url: string) => Promise<FetchedRegulationSource> = () =>
    Promise.resolve({ title: "AMLR", text: "Článek 1" }),
) {
  const internalPolicyRepository = new InMemoryInternalPolicyRepository();
  const ruleRepository = new InMemoryRuleRepository();
  const regulationRepository = new InMemoryRegulationRepository();
  const draftingJobRepository = new InMemoryDraftingJobRepository(
    internalPolicyRepository,
    ruleRepository,
    REVIEWED_AT,
  );
  const fetchedUrls: string[] = [];
  const executor = new DraftingJobExecutor({
    draftingJobRepository,
    draftGenerator: generator,
    regulationRepository,
    internalPolicyRepository,
    regulationSourceFetcher: {
      fetchSource: (url) => {
        fetchedUrls.push(url);
        return fetchSource(url);
      },
    },
    clock: fixedClock,
  });

  return {
    executor,
    generator,
    draftingJobRepository,
    internalPolicyRepository,
    ruleRepository,
    regulationRepository,
    fetchedUrls,
  };
}

async function createPastedPolicyJob(context: ReturnType<typeof setUp>, scope: string | null = null) {
  const regulation = await context.regulationRepository.createRegulation({
    code: "AML",
    title: "Zákon č. 253/2008 Sb.",
    kind: "law",
    sourceUrl: null,
    checkedAt: null,
  });
  const version = await context.regulationRepository.createVersion({
    regulationId: regulation.id,
    label: "znění 2026",
    fullText: "§ 21",
  });

  return context.draftingJobRepository.createJob({
    kind: "policy_from_regulation",
    parentJobId: null,
    sourceKind: "text",
    sourceUrl: null,
    scope,
    versionLabel: null,
    regulationId: regulation.id,
    regulationVersionId: version.id,
    policyVersionId: null,
    createdBy: ADMIN_ID,
  });
}

function createUrlPolicyJob(context: ReturnType<typeof setUp>) {
  return context.draftingJobRepository.createJob({
    kind: "policy_from_regulation",
    parentJobId: null,
    sourceKind: "url",
    sourceUrl: SOURCE_URL,
    scope: null,
    versionLabel: null,
    regulationId: null,
    regulationVersionId: null,
    policyVersionId: null,
    createdBy: ADMIN_ID,
  });
}

async function createRulesJob(context: ReturnType<typeof setUp>, legalBases: PolicyLegalBasis[]) {
  const policy = await context.internalPolicyRepository.createPolicy({ code: "SVZ-TM", title: "Monitoring" });
  const version = await context.internalPolicyRepository.createVersion({
    policyId: policy.id,
    body: "# Monitoring",
    status: "approved",
    createdVia: "wizard",
    createdBy: ADMIN_ID,
    legalBases,
  });
  const job = await context.draftingJobRepository.createJob(
    newRulesFromPolicyJob({ policyVersionId: version.id, parentJobId: null, createdBy: ADMIN_ID }),
  );

  return { policy, version, job };
}

describe("DraftingJobExecutor", () => {
  describe("policy_from_regulation", () => {
    it("drafts policy versions from a pasted regulation version and passes the scope", async () => {
      const context = setUp();
      const job = await createPastedPolicyJob(context, "Hlava III");

      await context.executor.executeJob(job.id);

      const finished = await context.draftingJobRepository.findJob(job.id);
      expect(finished).toEqual(
        expect.objectContaining({
          status: "succeeded",
          attempts: 1,
          startedAt: REVIEWED_AT,
          finishedAt: REVIEWED_AT,
        }),
      );
      expect(finished?.policyVersions).toHaveLength(1);
      expect(context.internalPolicyRepository.versions.get(finished?.policyVersions[0]?.id ?? "")).toEqual(
        expect.objectContaining({ status: "draft", createdVia: "wizard", createdBy: ADMIN_ID }),
      );
      expect(context.generator.scopes).toEqual(["Hlava III"]);
      expect(context.fetchedUrls).toEqual([]);
    });

    it("fetches a URL source, creates the regulation and its version and attaches them to the job", async () => {
      const context = setUp();
      const job = await createUrlPolicyJob(context);

      await context.executor.executeJob(job.id);

      const finished = await context.draftingJobRepository.findJob(job.id);
      const [regulation] = context.regulationRepository.regulations.values();
      expect(context.fetchedUrls).toEqual([SOURCE_URL]);
      expect(regulation).toEqual(
        expect.objectContaining({
          title: "AMLR",
          kind: "guidance",
          sourceUrl: SOURCE_URL,
          checkedAt: REVIEWED_AT,
        }),
      );
      expect(context.regulationRepository.versions.get(finished?.regulationVersionId ?? "")).toEqual(
        expect.objectContaining({ fullText: "Článek 1", label: "Načteno z URL k 2026-10-19" }),
      );
      expect(finished).toEqual(
        expect.objectContaining({ status: "succeeded", regulationId: regulation?.id }),
      );
    });

    it("adds a new version to a regulation already imported from the same URL", async () => {
      const context = setUp();
      await context.executor.executeJob((await createUrlPolicyJob(context)).id);
      await context.executor.executeJob((await createUrlPolicyJob(context)).id);

      expect(context.regulationRepository.regulations.size).toBe(1);
      expect(context.regulationRepository.versions.size).toBe(2);
    });

    it("fails the job when the page has no text", async () => {
      const context = setUp(createGenerator(), () => Promise.resolve({ title: null, text: "  " }));
      const job = await createUrlPolicyJob(context);

      await expect(context.executor.executeJob(job.id)).rejects.toThrow("No regulation text");

      expect((await context.draftingJobRepository.findJob(job.id))?.status).toBe("failed");
    });
  });

  describe("rules_from_policy", () => {
    it("drafts disabled rules with draft versions derived from the policy version", async () => {
      const context = setUp();
      const { policy, version, job } = await createRulesJob(context, [
        { regulationVersionId: "regulation-version-1", ref: "§ 21" },
      ]);

      await context.executor.executeJob(job.id);

      const finished = await context.draftingJobRepository.findJob(job.id);
      const [rule] = context.ruleRepository.rules.values();
      expect(finished).toEqual(expect.objectContaining({ status: "succeeded", warnings: [] }));
      expect(finished?.ruleVersions).toHaveLength(1);
      expect(rule).toEqual(expect.objectContaining({ policyId: policy.id, isEnabled: false }));
      expect(context.ruleRepository.versions.get(finished?.ruleVersions[0]?.id ?? "")).toEqual(
        expect.objectContaining({
          status: "draft",
          createdVia: "wizard",
          derivedFromPolicyVersionId: version.id,
        }),
      );
    });

    it("skips an invalid rule draft with a warning and keeps the valid ones", async () => {
      const generator = createGenerator({
        draftRules: () =>
          Promise.resolve([
            buildRuleDraft(),
            buildRuleDraft({ code: "R-NO-BASIS", legalBases: [] }),
            buildRuleDraft({ code: "R-NO-SCORE", baseScore: null }),
          ]),
      });
      const context = setUp(generator);
      const { job } = await createRulesJob(context, []);

      await context.executor.executeJob(job.id);

      const finished = await context.draftingJobRepository.findJob(job.id);
      expect(finished?.ruleVersions).toHaveLength(1);
      expect(finished?.warnings).toEqual([
        "Rule draft R-NO-BASIS was skipped: a rule version needs at least one legal basis",
        expect.stringContaining("Rule draft R-NO-SCORE was skipped"),
      ]);
    });
  });

  it("marks the job failed and rethrows when drafting fails", async () => {
    const context = setUp(
      createGenerator({ draftPolicies: () => Promise.reject(new Error("Bedrock throttled")) }),
    );
    const job = await createPastedPolicyJob(context);

    await expect(context.executor.executeJob(job.id)).rejects.toThrow("Bedrock throttled");

    expect(await context.draftingJobRepository.findJob(job.id)).toEqual(
      expect.objectContaining({
        status: "failed",
        errorMessage: "Bedrock throttled",
        finishedAt: REVIEWED_AT,
      }),
    );
  });

  it("does nothing on a repeated invocation of a job that already ran", async () => {
    const context = setUp();
    const job = await createPastedPolicyJob(context);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await context.executor.executeJob(job.id);
    await context.executor.executeJob(job.id);
    warn.mockRestore();

    expect(context.internalPolicyRepository.policies.size).toBe(1);
    expect((await context.draftingJobRepository.findJob(job.id))?.attempts).toBe(1);
  });
});
