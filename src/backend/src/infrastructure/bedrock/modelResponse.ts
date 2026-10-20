import { createHash } from "node:crypto";

import { recordAuditEvent } from "../../application/audit/auditLog";

export class MalformedModelResponseError extends Error {}

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
};

type ModelMessage = {
  stop_reason: string | null;
  content: ReadonlyArray<{ type: string; text?: string }>;
};

// Logged after every successful call so the team can watch credit spend during the hackathon.
export function logTokenUsage(operation: string, modelId: string, usage: TokenUsage): void {
  console.log(
    `[bedrock] ${operation} model=${modelId} input_tokens=${usage.input_tokens} ` +
      `output_tokens=${usage.output_tokens} cache_read_tokens=${usage.cache_read_input_tokens ?? 0} ` +
      `cache_write_tokens=${usage.cache_creation_input_tokens ?? 0}`,
  );
}

// Prompts and responses go to the database (drafts, alert_triage_llm_calls), the audit log keeps their hashes.
export function recordLlmCall(call: {
  operation: string;
  modelId: string;
  system: string;
  userPrompt: string;
  message: ModelMessage & { id: string; usage: TokenUsage };
  durationMs: number;
}): void {
  const { message } = call;
  const responseText = JSON.stringify(message.content);

  recordAuditEvent({
    action: "llm_call.completed",
    entityType: "llm_call",
    entityId: message.id,
    actorId: null,
    payload: {
      operation: call.operation,
      modelId: call.modelId,
      stopReason: message.stop_reason,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      durationMs: call.durationMs,
      systemPromptSha256: sha256(call.system),
      userPromptSha256: sha256(call.userPrompt),
      userPromptCharacters: call.userPrompt.length,
      responseSha256: sha256(responseText),
      responseCharacters: responseText.length,
    },
  });
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// A response cut off by max_tokens is incomplete, so it is rejected instead of being parsed or stored.
export function readCompleteText(message: ModelMessage): string {
  if (message.stop_reason !== "end_turn") {
    throw new MalformedModelResponseError(`Model stopped with "${message.stop_reason}" before finishing`);
  }

  return readText(message);
}

export function readText(message: ModelMessage): string {
  const text = message.content.find((block) => block.type === "text")?.text;

  if (text === undefined) {
    throw new MalformedModelResponseError("Model response contains no text block");
  }

  return text;
}
