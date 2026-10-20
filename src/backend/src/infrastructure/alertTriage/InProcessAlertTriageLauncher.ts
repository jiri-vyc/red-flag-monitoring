import type { AlertTriageLauncher, LlmTriageRequest } from "../../application/alertTriage/alertTriagePorts";

// A Lambda Web Function can stop the environment mid-way; repeating the request continues the triage.
export class InProcessAlertTriageLauncher implements AlertTriageLauncher {
  constructor(private readonly runLlmTriage: (request: LlmTriageRequest) => Promise<unknown>) {}

  launchLlmTriage(request: LlmTriageRequest): Promise<void> {
    setImmediate(() => {
      this.runLlmTriage(request).catch((error: unknown) => {
        console.error(`LLM triage of run ${request.runId} failed`, error);
      });
    });

    return Promise.resolve();
  }
}
