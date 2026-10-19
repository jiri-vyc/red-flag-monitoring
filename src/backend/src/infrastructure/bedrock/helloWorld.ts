import type AnthropicBedrock from "@anthropic-ai/bedrock-sdk";

import { logTokenUsage, readText } from "./modelResponse";

const HELLO_WORLD_MAX_OUTPUT_TOKENS = 50;

// Cheapest possible model call, to check model access and credentials before a real drafting run.
export async function sayHelloWorld(client: AnthropicBedrock, modelId: string): Promise<string> {
  const message = await client.messages.create({
    model: modelId,
    max_tokens: HELLO_WORLD_MAX_OUTPUT_TOKENS,
    messages: [{ role: "user", content: "Pozdrav jednou krátkou českou větou." }],
  });

  logTokenUsage("helloWorld", modelId, message.usage);

  return readText(message);
}
