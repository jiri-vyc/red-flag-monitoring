import type AnthropicBedrock from "@anthropic-ai/bedrock-sdk";

import type { InternalPolicyDrafter, PolicyDraftingRequest } from "../../application/draftInternalPolicy";
import { logTokenUsage, readCompleteText } from "./modelResponse";
import { createPolicyDraftingUserPrompt, POLICY_DRAFTING_SYSTEM_PROMPT } from "./policyDraftingPrompt";

// A full policy draft is ~10–12k tokens; 16k stays under the SDK limit for non-streaming requests.
const MAX_OUTPUT_TOKENS = 16_000;

export class BedrockInternalPolicyDrafter implements InternalPolicyDrafter {
  constructor(
    private readonly client: AnthropicBedrock,
    private readonly modelId: string,
  ) {}

  async draftInternalPolicy(request: PolicyDraftingRequest): Promise<string> {
    const message = await this.client.messages.create({
      model: this.modelId,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: POLICY_DRAFTING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: createPolicyDraftingUserPrompt(request) }],
    });

    logTokenUsage("draftInternalPolicy", this.modelId, message.usage);

    return readCompleteText(message).trim();
  }
}
