import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { getTokenProvider } from "@aws/bedrock-token-generator";

import type { BedrockAuth, BedrockConfig } from "../../config";

// AWS caps short-term Bedrock API keys at 12 hours, and at the expiry of the signing credentials (e.g. the SSO session).
const SHORT_TERM_API_KEY_TTL_SECONDS = 12 * 60 * 60;

export async function createBedrockClient(config: BedrockConfig): Promise<AnthropicBedrock> {
  switch (config.auth.kind) {
    case "api_key":
      return new AnthropicBedrock({ apiKey: config.auth.apiKey, awsRegion: config.region });
    case "short_term_api_key":
      return new AnthropicBedrock({
        apiKey: await generateShortTermApiKey(config.region),
        awsRegion: config.region,
      });
    case "iam":
      // Signs every request with the default AWS credential chain; on Lambda these are the execution role's
      // credentials, which refresh themselves and need only bedrock:InvokeModel.
      return new AnthropicBedrock({ awsRegion: config.region });
  }
}

export function describeBedrockAuth(auth: BedrockAuth): string {
  switch (auth.kind) {
    case "api_key":
      return "Bedrock API key from AWS_BEARER_TOKEN_BEDROCK";
    case "short_term_api_key":
      return "short-term Bedrock API key from AWS credentials";
    case "iam":
      return "IAM signing with AWS credentials";
  }
}

// Signs the key with the default AWS credential chain (AWS_PROFILE, SSO, env vars), so no secret is stored.
// Calls with the key need bedrock:CallWithBearerToken in addition to bedrock:InvokeModel.
function generateShortTermApiKey(region: string): Promise<string> {
  const provideToken = getTokenProvider({ region, expiresInSeconds: SHORT_TERM_API_KEY_TTL_SECONDS });

  return provideToken();
}
