import type AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { z } from "zod";

import type { AlertTriageModel, LlmTriageResult } from "../../application/alertTriage/alertTriagePorts";
import type { ClientTriageCase, TriageProposal } from "../../domain/alertTriage";
import type { JsonValue } from "../../domain/json";
import {
  ALERT_TRIAGE_SYSTEM_PROMPT,
  alertTriageJsonSchema,
  createAlertTriageUserPrompt,
} from "./alertTriagePrompt";
import { logTokenUsage, MalformedModelResponseError, readCompleteText, recordLlmCall } from "./modelResponse";

const MAX_OUTPUT_TOKENS = 4_000;

const triageResponseSchema = z.object({
  client_assessment: z.string(),
  alerts: z.array(
    z.object({ alert_id: z.string(), triage: z.enum(["FP", "REVIEW"]), reason: z.string().min(1) }),
  ),
});

export class BedrockAlertTriageModel implements AlertTriageModel {
  constructor(
    private readonly dependencies: { createClient: () => Promise<AnthropicBedrock>; modelId: string },
  ) {}

  get modelId(): string {
    return this.dependencies.modelId;
  }

  async triageClient(input: {
    triageCase: ClientTriageCase;
    proposals: TriageProposal[];
  }): Promise<LlmTriageResult> {
    const { modelId } = this.dependencies;
    const userPrompt = createAlertTriageUserPrompt(input);
    const client = await this.dependencies.createClient();
    const startedAt = Date.now();
    const message = await client.messages.create({
      model: modelId,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: ALERT_TRIAGE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: { type: "json_schema", schema: alertTriageJsonSchema } },
    });
    const durationMs = Date.now() - startedAt;

    logTokenUsage("triageClient", modelId, message.usage);
    recordLlmCall({
      operation: "triageClient",
      modelId,
      system: ALERT_TRIAGE_SYSTEM_PROMPT,
      userPrompt,
      message,
      durationMs,
    });

    const parsed = triageResponseSchema.safeParse(JSON.parse(readCompleteText(message)));

    if (!parsed.success) {
      throw new MalformedModelResponseError(
        `Triage response does not match the schema: ${parsed.error.message}`,
      );
    }

    return {
      clientAssessment: parsed.data.client_assessment,
      decisions: parsed.data.alerts.map(({ alert_id, triage, reason }) => ({
        alertId: alert_id,
        triage,
        reason,
      })),
      call: {
        modelId,
        systemPrompt: ALERT_TRIAGE_SYSTEM_PROMPT,
        userPrompt,
        response: JSON.parse(JSON.stringify(message)) as JsonValue,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        durationMs,
      },
    };
  }
}
