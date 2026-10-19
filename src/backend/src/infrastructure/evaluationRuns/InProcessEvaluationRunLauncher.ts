import type { EvaluationRunLauncher } from "../../application/evaluationRuns/evaluationRunPorts";
import type { EvaluationRunExecutor } from "../../application/evaluationRuns/evaluationRunExecutor";

// Local development: the run executes in the API process after the response is sent. On a Lambda Web Function
// the environment can be removed mid-run, so deployments use LambdaEvaluationRunLauncher instead.
export class InProcessEvaluationRunLauncher implements EvaluationRunLauncher {
  constructor(private readonly evaluationRunExecutor: EvaluationRunExecutor) {}

  launchRun(runId: string): Promise<void> {
    // Detached on purpose: failures are recorded on the run by the executor and logged here.
    setImmediate(() => {
      this.evaluationRunExecutor.executeRun(runId).catch((error: unknown) => {
        console.error(`Evaluation run ${runId} failed`, error);
      });
    });

    return Promise.resolve();
  }
}
