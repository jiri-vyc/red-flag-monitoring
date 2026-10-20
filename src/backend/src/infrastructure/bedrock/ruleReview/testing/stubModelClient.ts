import type { ModelClient, ModelMessage, ModelRequestBody } from "../modelCall";

export type StubResponse = ModelMessage | Error;

// Answers each request with the next scripted response (an Error is thrown) and records every request body.
export function createStubModelClient(respond: (body: ModelRequestBody, callIndex: number) => StubResponse): {
  client: ModelClient;
  requests: ModelRequestBody[];
} {
  const requests: ModelRequestBody[] = [];
  const client: ModelClient = {
    messages: {
      create: async (body) => {
        const response = respond(structuredClone(body), requests.length);
        requests.push(structuredClone(body));

        if (response instanceof Error) {
          throw response;
        }

        return response;
      },
    },
  };

  return { client, requests };
}

export function toolUseMessage(
  toolUses: { id: string; name: string; input: unknown }[],
  usage: Partial<ModelMessage["usage"]> = {},
): ModelMessage {
  return {
    stop_reason: "tool_use",
    content: toolUses.map((toolUse) => ({ type: "tool_use", ...toolUse })),
    usage: createUsage(usage),
  };
}

export function textMessage(text: string, usage: Partial<ModelMessage["usage"]> = {}): ModelMessage {
  return { stop_reason: "end_turn", content: [{ type: "text", text }], usage: createUsage(usage) };
}

function createUsage(usage: Partial<ModelMessage["usage"]>): ModelMessage["usage"] {
  return {
    input_tokens: 1_000,
    output_tokens: 200,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    ...usage,
  };
}
