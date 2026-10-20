import type { EvaluationRun, RunScope } from "../../domain/evaluation";
import { recordAuditEvent } from "../audit/auditLog";
import type { Clock } from "../clock";
import { BusinessRuleViolationError, toErrorMessage } from "../errors";
import type {
  EvaluationInputRepository,
  EvaluationRunLauncher,
  EvaluationRunRepository,
} from "./evaluationRunPorts";
import { calculateTransactionSetDigest, describeRunScope } from "./runScope";

export type StartRunCommand = { scope: RunScope; hitThreshold: number; createdBy: string };

export class EvaluationRunUseCases {
  constructor(
    private readonly dependencies: {
      evaluationInputRepository: EvaluationInputRepository;
      evaluationRunRepository: EvaluationRunRepository;
      evaluationRunLauncher: EvaluationRunLauncher;
      clock: Clock;
      engineVersion: string;
    },
  ) {}

  // Fixes the rule set and the transactions in scope (V5), stores the run as `running` and hands it to the
  // launcher. The run's progress and result are read through EvaluationRunQueries.
  async startRun(command: StartRunCommand): Promise<EvaluationRun> {
    const { evaluationInputRepository, evaluationRunRepository } = this.dependencies;
    const ruleVersionIds = await evaluationInputRepository.listRunnableRuleVersionIds();

    if (ruleVersionIds.length === 0) {
      throw new BusinessRuleViolationError("No enabled deterministic rule has an active approved version");
    }

    const transactionIds = await evaluationInputRepository.listScopedTransactionIds(command.scope);

    if (transactionIds.length === 0) {
      throw new BusinessRuleViolationError("The run scope matches no transactions");
    }

    const run = await evaluationRunRepository.createRun({
      scope: command.scope,
      fileName: describeRunScope(command.scope),
      fileSha256: calculateTransactionSetDigest(transactionIds),
      transactionCount: transactionIds.length,
      hitThreshold: command.hitThreshold,
      engineVersion: this.dependencies.engineVersion,
      createdBy: command.createdBy,
      ruleVersionIds,
      referenceListVersionIds: await evaluationInputRepository.listLatestReferenceListVersionIds(),
    });
    recordAuditEvent({
      action: "evaluation_run.started",
      entityType: "evaluation_run",
      entityId: run.id,
      actorId: command.createdBy,
      payload: {
        scope: command.scope,
        hitThreshold: command.hitThreshold,
        transactionCount: transactionIds.length,
        ruleVersionIds,
        transactionSetSha256: run.fileSha256,
      },
    });

    await this.launchCreatedRun(run.id);

    return run;
  }

  // A run the launcher could not start would stay `running` forever, so it is failed right away.
  private async launchCreatedRun(runId: string): Promise<void> {
    try {
      await this.dependencies.evaluationRunLauncher.launchRun(runId);
    } catch (error) {
      await this.dependencies.evaluationRunRepository.markRunFailed({
        runId,
        errorMessage: `The run could not be launched: ${toErrorMessage(error)}`,
        finishedAt: this.dependencies.clock(),
      });

      throw error;
    }
  }
}
