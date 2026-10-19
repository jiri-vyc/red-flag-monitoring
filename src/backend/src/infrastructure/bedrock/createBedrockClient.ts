import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { getTokenProvider } from "@aws/bedrock-token-generator";

import type { BedrockConfig } from "../../config";

// AWS caps short-term Bedrock API keys at 12 hours, and at the expiry of the signing credentials (e.g. the SSO session).
const SHORT_TERM_API_KEY_TTL_SECONDS = 12 * 60 * 60;

export async function createBedrockClient(config: BedrockConfig): Promise<AnthropicBedrock> {
  const apiKey = config.apiKey ?? (await generateShortTermApiKey(config.region));

  return new AnthropicBedrock({ apiKey, awsRegion: config.region });
}

// Signs the key with the default AWS credential chain (AWS_PROFILE, SSO, env vars), so no secret is stored.
function generateShortTermApiKey(region: string): Promise<string> {
  const provideToken = getTokenProvider({ region, expiresInSeconds: SHORT_TERM_API_KEY_TTL_SECONDS });

  return provideToken();
}
