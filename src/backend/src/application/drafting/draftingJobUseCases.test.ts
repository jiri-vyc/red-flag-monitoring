import { DRAFTING_JOB_TIMEOUT_MS } from "../../domain/draftingJob";
import { BusinessRuleViolationError } from "../errors";
import { RegulationUseCases } from "../regulations/regulationUseCases";
import { InMemoryDraftingJobRepository } from "../testing/InMemoryDraftingJobRepository";
import { InMemoryInternalPolicyRepository } from "../testing/InMemoryInternalPolicyRepository";
import { InMemoryRegulationRepository } from "../testing/InMemoryRegulationRepository";
import { InMemoryRuleRepository } from "../testing/InMemoryRuleRepository";
import { ADMIN_ID, REVIEWED_AT } from "../testing/fixtures";
import { DraftingJobUseCases, type StartPolicyJobCommand } from "./draftingJobUseCases";

const NEW_REGULATION = {
  kind: "new",
  regulation: { code: "AML", title: "Zákon č. 253/2008 Sb.", kind: "law", sourceUrl: null, checkedAt: null },
} as const;

const PASTED_COMMAND: StartPolicyJobCommand = {
  source: { kind: "markdown", content: "# § 21" },
  regulation: NEW_REGULATION,
  versionLabel: null,
  scope: null,
  createdBy: ADMIN_ID,
};

function setUp(options: { launchError?: Error; now?: Date } = {}) {
  const regulationRepository = new InMemoryRegulationRepository();
  const draftingJobRepository = new InMemoryDraftingJobRepository(
    new InMemoryInternalPolicyRepository(),
    new InMemoryRuleRepository(),
    REVIEWED_AT,
  );
  const launchedJobIds: string[] = [];
  const draftingJobUseCases = new DraftingJobUseCases({
    draftingJobRepository,
    draftingJobLauncher: {
      launchJob: (jobId) => {
        launchedJobIds.push(jobId);
        return options.launchError ? Promise.reject(options.launchError) : Promise.resolve();
      },
    },
    regulationUseCases: new RegulationUseCases(regulationRepository),
    clock: () => options.now ?? REVIEWED_AT,
  });

  return { draftingJobUseCases, draftingJobRepository, regulationRepository, launchedJobIds };
}

describe("DraftingJobUseCases", () => {
  describe("startPolicyJob", () => {
    it("stores pasted text as a regulation version and launches a pending job for it", async () => {
      const { draftingJobUseCases, regulationRepository, launchedJobIds } = setUp();

      const job = await draftingJobUseCases.startPolicyJob(PASTED_COMMAND);

      const version = regulationRepository.versions.get(job.regulationVersionId ?? "");
      expect(job).toEqual(
        expect.objectContaining({
          kind: "policy_from_regulation",
          status: "pending",
          sourceKind: "markdown",
        }),
      );
      expect(version).toEqual(
        expect.objectContaining({
          regulationId: job.regulationId,
          fullText: "# § 21",
          label: "Vloženo k 2026-10-19",
        }),
      );
      expect(launchedJobIds).toEqual([job.id]);
    });

    it("leaves fetching a URL to the worker and keeps the requested version label for it", async () => {
      const { draftingJobUseCases, regulationRepository } = setUp();

      const job = await draftingJobUseCases.startPolicyJob({
        ...PASTED_COMMAND,
        source: { kind: "url", url: "https://www.zakonyprolidi.cz/cs/2008-253" },
        regulation: null,
        versionLabel: "znění 2026",
      });

      expect(job).toEqual(
        expect.objectContaining({
          regulationId: null,
          regulationVersionId: null,
          versionLabel: "znění 2026",
        }),
      );
      expect(regulationRepository.regulations.size).toBe(0);
    });

    it("refuses a URL outside the allowed regulation sources", async () => {
      const { draftingJobUseCases } = setUp();

      await expect(
        draftingJobUseCases.startPolicyJob({
          ...PASTED_COMMAND,
          source: { kind: "url", url: "http://169.254.169.254/latest/meta-data" },
        }),
      ).rejects.toBeInstanceOf(BusinessRuleViolationError);
    });

    it("refuses pasted text without a regulation", async () => {
      const { draftingJobUseCases } = setUp();

      await expect(
        draftingJobUseCases.startPolicyJob({ ...PASTED_COMMAND, regulation: null }),
      ).rejects.toBeInstanceOf(BusinessRuleViolationError);
    });

    it("returns the job as failed when it cannot be launched", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      const { draftingJobUseCases, draftingJobRepository } = setUp({
        launchError: new Error("AccessDenied"),
      });

      const job = await draftingJobUseCases.startPolicyJob(PASTED_COMMAND);
      consoleError.mockRestore();

      expect(job).toEqual(
        expect.objectContaining({
          status: "failed",
          errorMessage: "The job could not be launched: AccessDenied",
        }),
      );
      expect((await draftingJobRepository.findJob(job.id))?.status).toBe("failed");
    });
  });

  describe("getJob and listJobs", () => {
    it("report an unfinished job past the timeout as failed", async () => {
      const now = new Date(REVIEWED_AT.getTime() + DRAFTING_JOB_TIMEOUT_MS);
      const { draftingJobUseCases } = setUp({ now });
      const job = await draftingJobUseCases.startPolicyJob(PASTED_COMMAND);

      const reported = await draftingJobUseCases.getJob(job.id);
      const failedJobs = await draftingJobUseCases.listJobs(
        { statuses: ["failed"], kinds: null, regulationId: null, policyVersionId: null },
        { limit: 50, offset: 0 },
      );

      expect(reported).toEqual(
        expect.objectContaining({ status: "failed", errorMessage: expect.any(String) }),
      );
      expect(failedJobs.items.map((item) => item.id)).toEqual([job.id]);
    });
  });

  describe("retryJob", () => {
    it("creates and launches a new job with the input of the failed one", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      const { draftingJobUseCases, launchedJobIds } = setUp({ launchError: new Error("AccessDenied") });
      const failed = await draftingJobUseCases.startPolicyJob(PASTED_COMMAND);
      consoleError.mockRestore();

      const retried = await retryWithLaunchErrorsSilenced(draftingJobUseCases, failed.id);

      expect(retried.id).not.toBe(failed.id);
      expect(retried).toEqual(
        expect.objectContaining({
          regulationId: failed.regulationId,
          regulationVersionId: failed.regulationVersionId,
          sourceKind: "markdown",
        }),
      );
      expect(launchedJobIds).toEqual([failed.id, retried.id]);
    });

    it("refuses to retry a job that has not failed", async () => {
      const { draftingJobUseCases } = setUp();
      const pending = await draftingJobUseCases.startPolicyJob(PASTED_COMMAND);

      await expect(draftingJobUseCases.retryJob(pending.id)).rejects.toBeInstanceOf(
        BusinessRuleViolationError,
      );
    });
  });
});

async function retryWithLaunchErrorsSilenced(draftingJobUseCases: DraftingJobUseCases, jobId: string) {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  const retried = await draftingJobUseCases.retryJob(jobId);
  consoleError.mockRestore();

  return retried;
}
