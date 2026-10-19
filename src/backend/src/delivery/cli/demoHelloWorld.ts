import { parseBedrockConfig } from "../../config";
import { createBedrockClient, describeBedrockAuth } from "../../infrastructure/bedrock/createBedrockClient";
import { sayHelloWorld } from "../../infrastructure/bedrock/helloWorld";

// Smoke test of Bedrock access: one tiny model call (a few dozen tokens), no database.
async function runHelloWorld(): Promise<void> {
  const bedrockConfig = parseBedrockConfig(process.env);
  console.log(
    `Model: ${bedrockConfig.modelId} (${bedrockConfig.region}), auth: ${describeBedrockAuth(bedrockConfig.auth)}`,
  );

  const client = await createBedrockClient(bedrockConfig);

  console.log(`Model says: ${await sayHelloWorld(client, bedrockConfig.modelId)}`);
}

runHelloWorld().catch((error: unknown) => {
  console.error("\nHello world failed:");
  console.error(error);
  process.exit(1);
});
