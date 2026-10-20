import type { NewAmlEvent, RuleHit } from "../../domain/amlEvent";
import type { EvaluationRun, RunScope } from "../../domain/evaluation";
import type { RunRuleSet } from "../../domain/evaluateTransaction";
import { buildClient, buildTransaction } from "../../domain/features/testing/featureTestData";
import type { EvaluationDataset } from "../../domain/transactionEvaluator";
import type { AmlEventRepository } from "../amlEvents/amlEventRepository";
import { BusinessRuleViolationError } from "../errors";
import { ADMIN_ID, fixedClock, REVIEWED_AT } from "../testing/fixtures";
import { EvaluationRunExecutor } from "./evaluationRunExecutor";
import type {
  EvaluationInputRepository,
  EvaluationRunLauncher,
  EvaluationRunRepository,
  NewEvaluationRun,
  RunFailure,
  StoredTransactionEvaluation,
} from "./evaluationRunPorts";
import { EvaluationRunUseCases } from "./evaluationRunUseCases";
import { UNLIMITED_RUN_SCOPE } from "./runScope";

const LARGE_PAYMENT_ID = "TX000000001";
const SMALL_PAYMENT_ID = "TX000000002";
const RULE_VERSION_ID = "rule-version-large";

const DATASET: EvaluationDataset = {
  clients: [buildClient()],
  transactions: [
    buildTransaction({ transactionId: LARGE_PAYMENT_ID, amount: "150000.00" }),
    buildTransaction({ transactionId: SMALL_PAYMENT_ID, amount: "1000.00" }),
  ],
  fxRates: [],
};

const RULE_SET: RunRuleSet = {
  ruleVersions: [
    {
      ruleVersionId: RULE_VERSION_ID,
      ruleId: "rule-large",
      ruleCode: "R-LARGE",
      isWhitelistAllowed: true,
      definition: {
        match: "all",
        features: ["tx_amount_czk"],
        conditions: [
          {
            id: "a",
            label: "Částka > 100 000",
            left: { feature: "tx_amount_czk" },
            op: ">",
            right: { value: 100000 },
          },
        ],
      },
      baseScore: 80,
      sensitivity: 100,
      riskProfiles: ["low", "medium", "high"],
    },
  ],
  referenceLists: new Map(),
  whitelistedClientIdsByRuleId: new Map(),
  hitThreshold: 50,
};

class FakeEvaluationInputRepository implements EvaluationInputRepository {
  ruleVersionIds = [RULE_VERSION_ID];
  scopedTransactionIds = [LARGE_PAYMENT_ID, SMALL_PAYMENT_ID];

  listRunnableRuleVersionIds = () => Promise.resolve(this.ruleVersionIds);
  listLatestReferenceListVersionIds = () => Promise.resolve(["list-version-hrj"]);
  listScopedTransactionIds = (_scope: RunScope) => Promise.resolve(this.scopedTransactionIds);
  loadDataset = () => Promise.resolve(DATASET);
}

class InMemoryEvaluationRunRepository implements EvaluationRunRepository {
  runs = new Map<string, EvaluationRun>();
  createdRuns: NewEvaluationRun[] = [];
  storedEvaluations: StoredTransactionEvaluation[] = [];

  createRun(newRun: NewEvaluationRun): Promise<EvaluationRun> {
    const run: EvaluationRun = {
      id: `run-${this.runs.size + 1}`,
      status: "running",
      scope: newRun.scope,
      fileName: newRun.fileName,
      fileSha256: newRun.fileSha256,
      rowsTotal: newRun.transactionCount,
      rowsImported: newRun.transactionCount,
      rowsRejected: 0,
      importErrors: [],
      hitThreshold: newRun.hitThreshold,
      engineVersion: newRun.engineVersion,
      txProcessed: 0,
      txPassed: 0,
      txFlagged: 0,
      txError: 0,
      createdBy: newRun.createdBy,
      createdAt: REVIEWED_AT,
      finishedAt: null,
      errorMessage: null,
    };
    this.createdRuns.push(newRun);
    this.runs.set(run.id, run);

    return Promise.resolve(run);
  }

  findRun = (runId: string) => Promise.resolve(this.runs.get(runId) ?? null);

  loadRunRuleSet = () => Promise.resolve(RULE_SET);

  appendTransactionEvaluations(input: { runId: string; evaluations: StoredTransactionEvaluation[] }) {
    this.storedEvaluations.push(...input.evaluations);
    this.updateRun(input.runId, (run) => ({ txProcessed: run.txProcessed + input.evaluations.length }));

    return Promise.resolve();
  }

  markRunCompleted(input: { runId: string; finishedAt: Date }) {
    this.updateRun(input.runId, () => ({ status: "completed", finishedAt: input.finishedAt }));

    return Promise.resolve();
  }

  markRunFailed(failure: RunFailure) {
    this.updateRun(failure.runId, () => ({
      status: "failed",
      finishedAt: failure.finishedAt,
      errorMessage: failure.errorMessage,
    }));

    return Promise.resolve();
  }

  private updateRun(runId: string, toChanges: (run: EvaluationRun) => Partial<EvaluationRun>): void {
    const run = this.runs.get(runId);

    if (run) {
      this.runs.set(runId, { ...run, ...toChanges(run) });
    }
  }
}

// Serves the hits of the stored evaluations, as the database would after the batches are written.
class InMemoryAmlEventRepository implements AmlEventRepository {
  createdAmlEvents: NewAmlEvent[] = [];

  constructor(private readonly evaluationRunRepository: InMemoryEvaluationRunRepository) {}

  listRunRuleHits(): Promise<RuleHit[]> {
    const ruleHits = this.evaluationRunRepository.storedEvaluations.flatMap((evaluation) =>
      evaluation.ruleEvaluations
        .filter((ruleEvaluation) => ruleEvaluation.outcome === "hit")
        .map((ruleEvaluation) => ({
          ruleEvaluationId: `${evaluation.transactionId}/${ruleEvaluation.ruleVersionId}`,
          ruleId: "rule-large",
          ruleVersionId: ruleEvaluation.ruleVersionId,
          ruleCode: "R-LARGE",
          alertType: "large_payment",
          alertGranularity: "transaction" as const,
          clientId: evaluation.clientId,
          transactionId: evaluation.transactionId,
          occurredAt: REVIEWED_AT,
          adjustedScore: ruleEvaluation.adjustedScore ?? 0,
        })),
    );

    return Promise.resolve(ruleHits);
  }

  createAmlEvents(input: { runId: string; amlEvents: NewAmlEvent[] }): Promise<void> {
    this.createdAmlEvents.push(...input.amlEvents);

    return Promise.resolve();
  }
}

function createSubject(launcher?: EvaluationRunLauncher) {
  const evaluationInputRepository = new FakeEvaluationInputRepository();
  const evaluationRunRepository = new InMemoryEvaluationRunRepository();
  const amlEventRepository = new InMemoryAmlEventRepository(evaluationRunRepository);
  const triagedRunIds: string[] = [];
  const executor = new EvaluationRunExecutor({
    evaluationInputRepository,
    evaluationRunRepository,
    amlEventRepository,
    ruleBasedTriage: {
      triageRunWithRules: (runId) => {
        triagedRunIds.push(runId);
        return Promise.resolve();
      },
    },
    clock: fixedClock,
  });
  const useCases = new EvaluationRunUseCases({
    evaluationInputRepository,
    evaluationRunRepository,
    evaluationRunLauncher: launcher ?? { launchRun: () => Promise.resolve() },
    clock: fixedClock,
    engineVersion: "test",
  });

  return {
    evaluationInputRepository,
    evaluationRunRepository,
    amlEventRepository,
    executor,
    useCases,
    triagedRunIds,
  };
}

const START_COMMAND = { scope: UNLIMITED_RUN_SCOPE, hitThreshold: 50, createdBy: ADMIN_ID };

describe("EvaluationRunUseCases.startRun", () => {
  it("creates a running run with the fixed versions and a digest of the scoped transactions", async () => {
    const { useCases, evaluationRunRepository } = createSubject();

    const run = await useCases.startRun(START_COMMAND);

    expect(run).toMatchObject({ status: "running", rowsTotal: 2, fileName: "database: all transactions" });
    expect(run.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evaluationRunRepository.createdRuns[0]).toMatchObject({
      ruleVersionIds: [RULE_VERSION_ID],
      referenceListVersionIds: ["list-version-hrj"],
      engineVersion: "test",
    });
  });

  it("refuses to start without a runnable rule", async () => {
    const { useCases, evaluationInputRepository } = createSubject();
    evaluationInputRepository.ruleVersionIds = [];

    await expect(useCases.startRun(START_COMMAND)).rejects.toThrow(BusinessRuleViolationError);
  });

  it("refuses to start when the scope matches no transactions", async () => {
    const { useCases, evaluationInputRepository } = createSubject();
    evaluationInputRepository.scopedTransactionIds = [];

    await expect(useCases.startRun(START_COMMAND)).rejects.toThrow(BusinessRuleViolationError);
  });

  it("fails the run when the launcher cannot start it", async () => {
    const { useCases, evaluationRunRepository } = createSubject({
      launchRun: () => Promise.reject(new Error("Lambda throttled")),
    });

    await expect(useCases.startRun(START_COMMAND)).rejects.toThrow("Lambda throttled");
    expect(evaluationRunRepository.runs.get("run-1")).toMatchObject({ status: "failed" });
  });
});

describe("EvaluationRunExecutor.executeRun", () => {
  it("evaluates the scoped transactions in order and completes the run", async () => {
    const { useCases, executor, evaluationRunRepository } = createSubject();
    const run = await useCases.startRun(START_COMMAND);

    await executor.executeRun(run.id);

    expect(evaluationRunRepository.runs.get(run.id)).toMatchObject({ status: "completed", txProcessed: 2 });
    expect(evaluationRunRepository.storedEvaluations).toMatchObject([
      { transactionId: LARGE_PAYMENT_ID, sourceRowNo: 1, verdict: "flagged" },
      { transactionId: SMALL_PAYMENT_ID, sourceRowNo: 2, verdict: "pass" },
    ]);
  });

  it("stores only rule results that are not a pass", async () => {
    const { useCases, executor, evaluationRunRepository } = createSubject();
    const run = await useCases.startRun(START_COMMAND);

    await executor.executeRun(run.id);

    const [flagged, passed] = evaluationRunRepository.storedEvaluations;
    expect(flagged?.ruleEvaluations).toMatchObject([{ outcome: "hit" }]);
    expect(passed?.ruleEvaluations).toEqual([]);
  });

  it("groups the stored hits into AML events before completing the run", async () => {
    const { useCases, executor, amlEventRepository } = createSubject();
    const run = await useCases.startRun(START_COMMAND);

    await executor.executeRun(run.id);

    expect(amlEventRepository.createdAmlEvents).toMatchObject([
      { alertId: `R-LARGE-${LARGE_PAYMENT_ID}`, transactionId: LARGE_PAYMENT_ID, maxScore: 80 },
    ]);
  });

  it("proposes the rule-based triage of the run's AML events", async () => {
    const { useCases, executor, triagedRunIds } = createSubject();
    const run = await useCases.startRun(START_COMMAND);

    await executor.executeRun(run.id);

    expect(triagedRunIds).toEqual([run.id]);
  });

  it("fails the run when its AML events cannot be stored", async () => {
    const { useCases, executor, amlEventRepository, evaluationRunRepository } = createSubject();
    amlEventRepository.createAmlEvents = () => Promise.reject(new Error("deadlock detected"));
    const run = await useCases.startRun(START_COMMAND);

    await expect(executor.executeRun(run.id)).rejects.toThrow("deadlock detected");
    expect(evaluationRunRepository.runs.get(run.id)).toMatchObject({ status: "failed" });
  });

  it("does not evaluate a run twice", async () => {
    const { useCases, executor, evaluationRunRepository } = createSubject();
    const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const run = await useCases.startRun(START_COMMAND);

    await executor.executeRun(run.id);
    await executor.executeRun(run.id);
    consoleWarn.mockRestore();

    expect(evaluationRunRepository.storedEvaluations).toHaveLength(2);
  });

  it("fails the run when the scoped transactions changed after the start", async () => {
    const { useCases, executor, evaluationInputRepository, evaluationRunRepository } = createSubject();
    const run = await useCases.startRun(START_COMMAND);
    evaluationInputRepository.scopedTransactionIds = [LARGE_PAYMENT_ID];

    await expect(executor.executeRun(run.id)).rejects.toThrow("changed");
    expect(evaluationRunRepository.runs.get(run.id)).toMatchObject({ status: "failed", txProcessed: 0 });
  });
});
