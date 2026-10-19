import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

import type { DraftingJobLauncher } from "../../application/drafting/draftingJobPorts";

export type DraftingWorkerEvent = { jobId: string };

// Async invocations are at-least-once; DraftingJobExecutor's claim makes a repeated one a no-op.
export class LambdaDraftingJobLauncher implements DraftingJobLauncher {
  private readonly lambdaClient: LambdaClient;

  constructor(private readonly config: { functionName: string; region: string }) {
    this.lambdaClient = new LambdaClient({ region: config.region });
  }

  async launchJob(jobId: string): Promise<void> {
    const event: DraftingWorkerEvent = { jobId };

    await this.lambdaClient.send(
      new InvokeCommand({
        FunctionName: this.config.functionName,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify(event)),
      }),
    );
  }
}
