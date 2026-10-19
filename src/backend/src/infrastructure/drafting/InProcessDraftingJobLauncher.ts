import type { DraftingJobExecutor } from "../../application/drafting/draftingJobExecutor";
import type { DraftingJobLauncher } from "../../application/drafting/draftingJobPorts";

// Local development only: on a Lambda Web Function the environment can be removed mid-job.
export class InProcessDraftingJobLauncher implements DraftingJobLauncher {
  constructor(private readonly draftingJobExecutor: DraftingJobExecutor) {}

  launchJob(jobId: string): Promise<void> {
    setImmediate(() => {
      this.draftingJobExecutor.executeJob(jobId).catch((error: unknown) => {
        console.error(`Drafting job ${jobId} failed`, error);
      });
    });

    return Promise.resolve();
  }
}
