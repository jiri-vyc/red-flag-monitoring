import { parseBedrockConfig } from "../../config";
import { createBedrockClient } from "../../infrastructure/bedrock/createBedrockClient";
import { sayHelloWorld } from "../../infrastructure/bedrock/helloWorld";

// Smoke test of Bedrock access: one tiny model call (a few dozen tokens), no database.
async function runHelloWorld(): Promise<void> {
  const bedrockConfig = parseBedrockConfig(process.env);
  const apiKeySource = bedrockConfig.apiKey
    ? "AWS_BEARER_TOKEN_BEDROCK"
    : "short-term key from AWS credentials";

  console.log(`Model: ${bedrockConfig.modelId} (${bedrockConfig.region}), API key: ${apiKeySource}`);

  const client = await createBedrockClient(bedrockConfig);

  console.log(`Model says: ${await sayHelloWorld(client, bedrockConfig.modelId)}`);
}

runHelloWorld().catch((error: unknown) => {
  console.error("\nHello world failed:");
  console.error(error);
  process.exit(1);
});
