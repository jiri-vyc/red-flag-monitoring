import { groupRuleHitsIntoAmlEvents } from "../../domain/amlEvent";
import type { EvaluationRun } from "../../domain/evaluation";
import { createTransactionEvaluator, type EvaluatedTransaction } from "../../domain/transactionEvaluator";
import type { AmlEventRepository } from "../amlEvents/amlEventRepository";
import { recordAuditEvent } from "../audit/auditLog";
import type { Clock } from "../clock";
import { BusinessRuleViolationError, NotFoundError, toErrorMessage } from "../errors";
import type {
  EvaluationInputRepository,
  EvaluationRunRepository,
  StoredTransactionEvaluation,
} from "./evaluationRunPorts";
import { calculateTransactionSetDigest } from "./runScope";

// Transactions evaluated and stored per database round trip; also the step of the progress counter.
export const EVALUATION_BATCH_SIZE = 1000;

export class RunScopeChangedError extends Error {}

// Evaluates a started run: loads the dataset once (D18), evaluates the transactions in scope chronologically,
// stores them in batches, groups the stored hits into AML events (#13) and proposes their rule-based triage (#14). Runs in the API process or in a
// separate worker, see EvaluationRunLauncher.
export class EvaluationRunExecutor {
  constructor(
    private readonly dependencies: {
      evaluationInputRepository: EvaluationInputRepository;
      evaluationRunRepository: EvaluationRunRepository;
      amlEventRepository: AmlEventRepository;
      ruleBasedTriage: { triageRunWithRules(runId: string): Promise<unknown> };
      clock: Clock;
    },
  ) {}

  async executeRun(runId: string): Promise<void> {
    const { evaluationRunRepository, clock } = this.dependencies;
    const run = await evaluationRunRepository.findRun(runId);

    if (!run) {
      throw new NotFoundError("Evaluation run", runId);
    }

    // A repeated invocation (e.g. a retried async Lambda call) must not evaluate the run twice.
    if (run.status !== "running" || run.txProcessed > 0) {
      console.warn(`Evaluation run ${runId} is ${run.status} with ${run.txProcessed} processed, skipping`);
      return;
    }

    try {
      await this.evaluateRunTransactions(run);
      await this.createRunAmlEvents(run.id);
      await this.dependencies.ruleBasedTriage.triageRunWithRules(run.id);
      await evaluationRunRepository.markRunCompleted({ runId, finishedAt: clock() });
      recordAuditEvent({
        action: "evaluation_run.completed",
        entityType: "evaluation_run",
        entityId: runId,
        actorId: run.createdBy,
        payload: { engineVersion: run.engineVersion },
      });
    } catch (error) {
      recordAuditEvent({
        action: "evaluation_run.failed",
        entityType: "evaluation_run",
        entityId: runId,
        actorId: run.createdBy,
        payload: { error: toErrorMessage(error) },
      });
      await evaluationRunRepository.markRunFailed({
        runId,
        errorMessage: toErrorMessage(error),
        finishedAt: clock(),
      });

      throw error;
    }
  }

  private async evaluateRunTransactions(run: EvaluationRun): Promise<void> {
    const { evaluationInputRepository, evaluationRunRepository } = this.dependencies;

    if (!run.scope) {
      throw new BusinessRuleViolationError(
        `Run ${run.id} has no database scope; CSV runs are not supported yet`,
      );
    }

    const [transactionIds, ruleSet, dataset] = await Promise.all([
      evaluationInputRepository.listScopedTransactionIds(run.scope),
      evaluationRunRepository.loadRunRuleSet({ runId: run.id, hitThreshold: run.hitThreshold }),
      evaluationInputRepository.loadDataset(),
    ]);

    if (calculateTransactionSetDigest(transactionIds) !== run.fileSha256) {
      throw new RunScopeChangedError("Transactions in the run scope changed after the run started");
    }

    const evaluateTransaction = createTransactionEvaluator({ dataset, ruleSet });

    for (let offset = 0; offset < transactionIds.length; offset += EVALUATION_BATCH_SIZE) {
      const batchIds = transactionIds.slice(offset, offset + EVALUATION_BATCH_SIZE);
      const evaluations = batchIds.map((transactionId, index) =>
        toStoredEvaluation(evaluateTransaction(transactionId), offset + index + 1),
      );

      await evaluationRunRepository.appendTransactionEvaluations({ runId: run.id, evaluations });
    }
  }

  // Events are grouped once all hits are stored, because a client_month event spans the whole run.
  private async createRunAmlEvents(runId: string): Promise<void> {
    const { amlEventRepository } = this.dependencies;
    const ruleHits = await amlEventRepository.listRunRuleHits(runId);

    await amlEventRepository.createAmlEvents({ runId, amlEvents: groupRuleHitsIntoAmlEvents(ruleHits) });
  }
}

// Storage policy (team decision for #3, narrows V6): only rule results that are not `pass` are stored, i.e.
// hits, errors and skips (whitelist, risk profile). Every transaction keeps its verdict, max score and hit
// count. ~400k transactions × 17 rules would otherwise be ~7M rows, and about half of the transactions are
// flagged by R-01 alone.
function toStoredEvaluation(
  evaluation: EvaluatedTransaction,
  sourceRowNo: number,
): StoredTransactionEvaluation {
  return {
    ...evaluation,
    sourceRowNo,
    ruleEvaluations: evaluation.ruleEvaluations.filter((ruleEvaluation) => ruleEvaluation.outcome !== "pass"),
  };
}
