import { parseBedrockConfig } from "../../config";
import { BedrockRuleCandidateExtractor } from "../../infrastructure/bedrock/BedrockRuleCandidateExtractor";
import { createBedrockClient } from "../../infrastructure/bedrock/createBedrockClient";

// Smoke test of Bedrock access: one tiny model call (a few dozen tokens), no regulation text.
async function runHelloWorld(): Promise<void> {
  const bedrockConfig = parseBedrockConfig(process.env);
  const apiKeySource = bedrockConfig.apiKey
    ? "AWS_BEARER_TOKEN_BEDROCK"
    : "short-term key from AWS credentials";

  console.log(`Model: ${bedrockConfig.modelId} (${bedrockConfig.region}), API key: ${apiKeySource}`);

  const client = await createBedrockClient(bedrockConfig);
  const extractor = new BedrockRuleCandidateExtractor(client, bedrockConfig.modelId);

  console.log(`Model says: ${await extractor.helloWorld()}`);
}

runHelloWorld().catch((error: unknown) => {
  console.error("\nHello world failed:");
  console.error(error);
  process.exit(1);
});
