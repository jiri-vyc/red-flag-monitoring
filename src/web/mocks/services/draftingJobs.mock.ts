import type { DraftingJobsService } from "@/features/draftingJobs/api/contract";
import type { DraftingJob, DraftingJobStatus } from "@/features/draftingJobs/types";
import type { RuleLegalBasis } from "@/features/regulations/types";
import type { Rule } from "@/features/rules/types";
import { ApiError } from "@/lib/apiError";
import { assertUnreachable } from "@/lib/assertUnreachable";

import { createMockId } from "../createMockId";
import {
  buildGeneratedPolicy,
  GENERAL_PROVISIONS_REF,
  WIZARD_RULE_BLUEPRINTS,
} from "../generation/policyGeneration";
import { deriveRuleName, generateRuleDraft } from "../generation/ruleGeneration";
import { simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import {
  readMockDatabase,
  writeMockDatabase,
  type MockDatabase,
  type MockDraftingJobInput,
  type MockDraftingJobRecord,
  type MockPolicyRecord,
} from "../store/mockDatabase";

const MOCK_POLL_INTERVAL_MS = 2_000;
const SIMULATED_QUEUE_MS = 1_500;
const SIMULATED_RUN_MS = 4_000;
const DEFAULT_LIST_LIMIT = 50;
const GENERATED_BY = "RedFlag AI (návrh)";

type JobOutput = Pick<DraftingJob, "policyIds" | "ruleIds">;
type WorkerResult = { database: MockDatabase } & ({ output: JobOutput } | { errorMessage: string });

/** M5: a rule version names its own provision; the mock proposes the policy's citations, reviewed with the rule. */
function proposeRuleLegalBases(policy: MockPolicyRecord): RuleLegalBasis[] {
  return policy.legalBases.map(({ regulationId, ref }) => ({
    regulationId,
    ref: ref ?? GENERAL_PROVISIONS_REF,
  }));
}

function generateRules(policy: MockPolicyRecord, now: string) {
  const legalBases = proposeRuleLegalBases(policy);
  return WIZARD_RULE_BLUEPRINTS.map((blueprint) => {
    const draft = generateRuleDraft({ description: blueprint.description, type: blueprint.type });
    const rule: Rule = {
      id: createMockId("rule"),
      name: deriveRuleName(blueprint.description),
      description: blueprint.description,
      type: blueprint.type,
      status: "draft",
      origin: "wizard",
      policyId: policy.id,
      runningVersionNumber: null,
      versions: [
        {
          versionNumber: 1,
          state: "draft",
          content: draft.content,
          config: {
            sensitivity: blueprint.sensitivity,
            riskProfiles: ["high", "medium", "low", "unknown"],
          },
          changeNote: "Vygenerováno wizardem z interního předpisu.",
          createdAt: now,
          createdBy: GENERATED_BY,
          reviewedBy: null,
          reviewedAt: null,
          legalBases,
        },
      ],
      whitelistAllowed: true,
      createdAt: now,
      updatedAt: now,
    };
    return { rule, checkKind: draft.checkKind };
  });
}

function draftPolicy(
  database: MockDatabase,
  job: DraftingJob,
  sourceLabel: string,
  now: string,
): WorkerResult {
  const regulation = database.regulations.find((candidate) => candidate.id === job.regulationId);
  if (!regulation) {
    return { database, errorMessage: `Regulation ${job.regulationId ?? "–"} no longer exists.` };
  }
  const policy = buildGeneratedPolicy({ id: createMockId("pol"), regulation, sourceLabel, now });
  return {
    database: { ...database, policies: [...database.policies, policy] },
    output: { policyIds: [policy.id], ruleIds: [] },
  };
}

function draftRules(database: MockDatabase, policyId: string, now: string): WorkerResult {
  const policy = database.policies.find((candidate) => candidate.id === policyId);
  if (!policy) {
    return { database, errorMessage: `Internal policy ${policyId} no longer exists.` };
  }
  const generated = generateRules(policy, now);
  return {
    database: {
      ...database,
      rules: [...database.rules, ...generated.map(({ rule }) => rule)],
      ruleCheckKinds: {
        ...database.ruleCheckKinds,
        ...Object.fromEntries(generated.map(({ rule, checkKind }) => [rule.id, checkKind])),
      },
    },
    output: { policyIds: [], ruleIds: generated.map(({ rule }) => rule.id) },
  };
}

function runSimulatedWorker(
  database: MockDatabase,
  record: MockDraftingJobRecord,
  now: string,
): WorkerResult {
  const { input } = record;
  switch (input.kind) {
    case "policy_from_regulation":
      return draftPolicy(database, record.job, input.sourceLabel, now);
    case "rules_from_policy":
      return draftRules(database, input.policyId, now);
    default:
      return assertUnreachable(input);
  }
}

function findSimulatedStatus(record: MockDraftingJobRecord, nowMs: number): DraftingJobStatus {
  if (record.job.status === "succeeded" || record.job.status === "failed") {
    return record.job.status;
  }
  const elapsedMs = nowMs - record.createdAtMs;
  if (elapsedMs < SIMULATED_QUEUE_MS) {
    return "pending";
  }
  return elapsedMs < SIMULATED_QUEUE_MS + SIMULATED_RUN_MS ? "running" : "succeeded";
}

function replaceJobRecord(database: MockDatabase, updatedRecord: MockDraftingJobRecord): MockDatabase {
  return {
    ...database,
    draftingJobs: database.draftingJobs.map((record) =>
      record.job.id === updatedRecord.job.id ? updatedRecord : record,
    ),
  };
}

function advanceJob(database: MockDatabase, record: MockDraftingJobRecord, nowMs: number): MockDatabase {
  const status = findSimulatedStatus(record, nowMs);
  if (status === record.job.status) {
    return database;
  }
  const claimedJob: DraftingJob = {
    ...record.job,
    attempts: Math.max(record.job.attempts, 1),
    startedAt: record.job.startedAt ?? new Date(record.createdAtMs + SIMULATED_QUEUE_MS).toISOString(),
  };
  if (status !== "succeeded") {
    return replaceJobRecord(database, { ...record, job: { ...claimedJob, status } });
  }
  const finishedAt = new Date(record.createdAtMs + SIMULATED_QUEUE_MS + SIMULATED_RUN_MS).toISOString();
  const result = runSimulatedWorker(database, record, finishedAt);
  const finishedJob: DraftingJob =
    "output" in result
      ? { ...claimedJob, ...result.output, status: "succeeded", finishedAt }
      : { ...claimedJob, status: "failed", errorMessage: result.errorMessage, finishedAt };
  return replaceJobRecord(result.database, { ...record, job: finishedJob });
}

export function advanceMockDraftingJobs(nowMs: number = Date.now()): MockDatabase {
  const database = readMockDatabase();
  const advancedDatabase = database.draftingJobs.reduce(
    (currentDatabase, record) => advanceJob(currentDatabase, record, nowMs),
    database,
  );
  if (advancedDatabase !== database) {
    writeMockDatabase(advancedDatabase);
  }
  return advancedDatabase;
}

export type NewMockDraftingJob = Pick<
  DraftingJob,
  "parentJobId" | "sourceKind" | "sourceUrl" | "regulationId"
> & {
  input: MockDraftingJobInput;
};

export function addMockDraftingJob(
  database: MockDatabase,
  { input, ...jobFields }: NewMockDraftingJob,
): { database: MockDatabase; job: DraftingJob } {
  const createdAtMs = Date.now();
  const job: DraftingJob = {
    id: createMockId("job"),
    kind: input.kind,
    status: "pending",
    ...jobFields,
    policyIds: [],
    ruleIds: [],
    errorMessage: null,
    warnings: [],
    attempts: 0,
    createdAt: new Date(createdAtMs).toISOString(),
    startedAt: null,
    finishedAt: null,
  };
  return {
    database: { ...database, draftingJobs: [...database.draftingJobs, { job, createdAtMs, input }] },
    job,
  };
}

function findJobRecord(database: MockDatabase, jobId: string): MockDraftingJobRecord {
  const record = database.draftingJobs.find((candidate) => candidate.job.id === jobId);
  return record ?? throwMockNotFound("Drafting job", jobId);
}

export const mockDraftingJobsService: DraftingJobsService = {
  pollIntervalMs: MOCK_POLL_INTERVAL_MS,

  async loadJobs({ statuses, kinds, limit = DEFAULT_LIST_LIMIT }) {
    await simulateLatency();
    const jobs = advanceMockDraftingJobs()
      .draftingJobs.toReversed()
      .map((record) => record.job)
      .filter((job) => !statuses || statuses.length === 0 || statuses.includes(job.status))
      .filter((job) => !kinds || kinds.length === 0 || kinds.includes(job.kind));
    return { items: jobs.slice(0, limit), total: jobs.length };
  },

  async loadJob(jobId) {
    await simulateLatency();
    return findJobRecord(advanceMockDraftingJobs(), jobId).job;
  },

  async retryJob(jobId) {
    await simulateLatency();
    const database = advanceMockDraftingJobs();
    const { job, input } = findJobRecord(database, jobId);
    if (job.status !== "failed") {
      throw new ApiError({ kind: "validation", status: 422, message: "Only a failed job can be retried." });
    }
    const { parentJobId, sourceKind, sourceUrl, regulationId } = job;
    const retried = addMockDraftingJob(database, { parentJobId, sourceKind, sourceUrl, regulationId, input });
    writeMockDatabase(retried.database);
    return retried.job;
  },
};
