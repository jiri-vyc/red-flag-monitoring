import type { JsonValue } from "../../../domain/json";
import { logTokenUsage, type TokenUsage } from "../modelResponse";
import type { LlmCallAudit } from "./contract";

export type ModelResponseBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown };
export type ModelMessage = {
  stop_reason: string | null;
  content: ReadonlyArray<ModelResponseBlock>;
  usage: TokenUsage;
};

export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
type AssistantBlock = { type: "text"; text: string } | ToolUseBlock;
export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error: boolean;
};
export type ModelMessageParam =
  { role: "user"; content: string | ToolResultBlock[] } | { role: "assistant"; content: AssistantBlock[] };

export type ModelTool = {
  name: string;
  description: string;
  input_schema: { type: "object"; [keyword: string]: unknown };
};

export type ModelRequestBody = {
  model: string;
  max_tokens: number;
  system: { type: "text"; text: string; cache_control: { type: "ephemeral" } }[];
  messages: ModelMessageParam[];
  tools?: ModelTool[];
  tool_choice?: { type: "auto" } | { type: "tool"; name: string };
};

export interface ModelClient {
  messages: {
    create(body: ModelRequestBody, options?: { signal?: AbortSignal }): Promise<ModelMessage>;
  };
}

export type ModelCallRequest = {
  purpose: LlmCallAudit["purpose"];
  findingId: string | null;
  isContinuation: boolean;
  system: string;
  messages: ModelMessageParam[];
  // The messages this call adds to the conversation; only these go into the audit record.
  newMessages: ModelMessageParam[];
  tools: ModelTool[];
  toolChoice: { type: "auto" } | { type: "tool"; name: string };
  maxTokens: number;
  signal?: AbortSignal;
};

export type ModelCallOutcome =
  | { isSuccess: true; message: ModelMessage; audit: LlmCallAudit }
  | { isSuccess: false; error: string; audit: LlmCallAudit };

// Never throws: a failed request comes back as an outcome with the error, audited like any other call.
export async function callModel(
  client: ModelClient,
  modelId: string,
  request: ModelCallRequest,
): Promise<ModelCallOutcome> {
  const startedAt = new Date();
  const auditBase = {
    purpose: request.purpose,
    findingId: request.findingId,
    modelId,
    startedAt: startedAt.toISOString(),
    prompt: {
      system: request.isContinuation ? null : request.system,
      tools: request.tools.map(({ name }) => name),
      messages: request.newMessages.map(toJsonValue),
    },
    toolCalls: [],
  };

  try {
    const message = await client.messages.create(
      {
        model: modelId,
        max_tokens: request.maxTokens,
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: request.messages,
        ...(request.tools.length > 0 && { tools: request.tools, tool_choice: request.toolChoice }),
      },
      { signal: request.signal },
    );

    logTokenUsage(request.purpose, modelId, message.usage);

    return {
      isSuccess: true,
      message,
      audit: {
        ...auditBase,
        durationMs: Date.now() - startedAt.getTime(),
        response: { stopReason: message.stop_reason, content: message.content.map(toJsonValue) },
        inputTokens: countInputTokens(message.usage),
        outputTokens: message.usage.output_tokens,
        errorMessage: null,
      },
    };
  } catch (error) {
    const errorMessage = describeError(error);

    return {
      isSuccess: false,
      error: errorMessage,
      audit: {
        ...auditBase,
        durationMs: Date.now() - startedAt.getTime(),
        response: null,
        inputTokens: 0,
        outputTokens: 0,
        errorMessage,
      },
    };
  }
}

export function findToolUses(message: ModelMessage): ToolUseBlock[] {
  return message.content.flatMap((block) => toToolUseBlocks(block));
}

// Only text and tool use go back to the model; other block types are not part of these conversations.
export function toAssistantMessage(message: ModelMessage): ModelMessageParam {
  const content = message.content.flatMap((block): AssistantBlock[] =>
    block.type === "text" && block.text !== undefined
      ? [{ type: "text", text: block.text }]
      : toToolUseBlocks(block),
  );

  return { role: "assistant", content };
}

export function readMessageText(message: ModelMessage): string {
  return message.content
    .flatMap((block) => (block.type === "text" && block.text !== undefined ? [block.text] : []))
    .join("\n")
    .trim();
}

export function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function toToolUseBlocks(block: ModelResponseBlock): ToolUseBlock[] {
  return block.type === "tool_use" && block.id !== undefined && block.name !== undefined
    ? [{ type: "tool_use", id: block.id, name: block.name, input: block.input }]
    : [];
}

function countInputTokens(usage: TokenUsage): number {
  return usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
}

export function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
