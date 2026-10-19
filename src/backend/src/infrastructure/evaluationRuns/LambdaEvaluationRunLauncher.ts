import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

import type { EvaluationRunLauncher } from "../../application/evaluationRuns/evaluationRunPorts";

// Payload of the evaluation worker Lambda, see evaluationWorker.ts.
export type EvaluationWorkerEvent = { runId: string };

// Deployments: a Lambda Web Function may remove its environment after the response, so the run executes in a
// separate Lambda function invoked asynchronously (InvocationType Event). The worker skips repeated invocations.
export class LambdaEvaluationRunLauncher implements EvaluationRunLauncher {
  private readonly lambdaClient: LambdaClient;

  constructor(private readonly config: { functionName: string; region: string }) {
    this.lambdaClient = new LambdaClient({ region: config.region });
  }

  async launchRun(runId: string): Promise<void> {
    const event: EvaluationWorkerEvent = { runId };

    await this.lambdaClient.send(
      new InvokeCommand({
        FunctionName: this.config.functionName,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify(event)),
      }),
    );
  }
}
