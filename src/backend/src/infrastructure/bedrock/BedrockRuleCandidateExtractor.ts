import type AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { z } from "zod";

import type { RuleCandidateExtractor, RuleExtractionRequest } from "../../application/extractRuleCandidates";
import { RULE_KINDS } from "../../domain/rule";
import { RULE_PARAMETER_SOURCES, type RuleCandidate } from "../../domain/ruleCandidate";
import { logTokenUsage, MalformedModelResponseError, readCompleteText, readText } from "./modelResponse";
import { createRuleExtractionUserPrompt, RULE_EXTRACTION_SYSTEM_PROMPT } from "./ruleExtractionPrompt";

const MAX_OUTPUT_TOKENS = 16_000;
const HELLO_WORLD_MAX_OUTPUT_TOKENS = 50;

const ruleCandidatesResponseSchema = z.strictObject({
  ruleCandidates: z.array(
    z.strictObject({
      ruleId: z.string(),
      title: z.string(),
      definition: z.string(),
      alertGranularity: z.string(),
      kind: z.enum(RULE_KINDS),
      parameters: z.array(
        z.strictObject({ name: z.string(), value: z.string(), source: z.enum(RULE_PARAMETER_SOURCES) }),
      ),
      regulationSources: z.array(z.strictObject({ regulation: z.string(), provisions: z.string() })),
      internalPolicySource: z.string(),
      openQuestions: z.array(z.string()),
    }),
  ),
});

// The "$schema" meta keyword is not part of a structured-output schema, so only the schema body is sent.
const ruleCandidatesJsonSchema = Object.fromEntries(
  Object.entries(z.toJSONSchema(ruleCandidatesResponseSchema)).filter(([keyword]) => keyword !== "$schema"),
);

export class BedrockRuleCandidateExtractor implements RuleCandidateExtractor {
  constructor(
    private readonly client: AnthropicBedrock,
    private readonly modelId: string,
  ) {}

  async extractRuleCandidates(request: RuleExtractionRequest): Promise<RuleCandidate[]> {
    const message = await this.client.messages.create({
      model: this.modelId,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: RULE_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: createRuleExtractionUserPrompt(request) }],
      output_config: { format: { type: "json_schema", schema: ruleCandidatesJsonSchema } },
    });

    logTokenUsage("extractRuleCandidates", this.modelId, message.usage);

    const responseText = readCompleteText(message);

    return parseRuleCandidates(responseText);
  }

  async helloWorld(): Promise<string> {
    const message = await this.client.messages.create({
      model: this.modelId,
      max_tokens: HELLO_WORLD_MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: "Pozdrav jednou krátkou českou větou." }],
    });

    logTokenUsage("helloWorld", this.modelId, message.usage);
    const responseText = readText(message);

    return responseText;
  }
}

function parseRuleCandidates(responseText: string): RuleCandidate[] {
  const parseResult = ruleCandidatesResponseSchema.safeParse(parseJson(responseText));

  if (!parseResult.success) {
    throw new MalformedModelResponseError(
      `Model response does not match the schema: ${parseResult.error.message}`,
    );
  }

  return parseResult.data.ruleCandidates;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new MalformedModelResponseError("Model response is not valid JSON", { cause: error });
  }
}
