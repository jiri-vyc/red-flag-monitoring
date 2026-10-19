const DEFAULT_PORT = 4000;
const DEFAULT_POSTGRES_PORT = 5432;
const DEFAULT_BEDROCK_REGION = "eu-central-1";
// EU cross-region inference profile keeps processing inside the EU.
const DEFAULT_BEDROCK_MODEL_ID = "eu.anthropic.claude-opus-4-5-20251101-v1:0";

export type PasswordDatabaseConfig = { authMode: "password"; url: string };
export type IamDatabaseConfig = {
  authMode: "iam";
  host: string;
  port: number;
  username: string;
  database: string;
  region: string;
};
export type DatabaseConfig = PasswordDatabaseConfig | IamDatabaseConfig;

// Where started evaluation runs (#3) and drafting jobs execute: in the API process, or in a separate Lambda.
export type WorkerConfig = { mode: "in_process" } | { mode: "lambda"; functionName: string; region: string };

export type AppConfig = {
  host?: string;
  port: number;
  database: DatabaseConfig;
  // V10: the code version stored on each evaluation run, the git commit in deployments.
  engineVersion: string;
  evaluationWorker: WorkerConfig;
  draftingWorker: WorkerConfig;
  draftGenerator: DraftGeneratorConfig;
};

const LOCAL_ENGINE_VERSION = "local";

// How Bedrock calls authenticate: a configured Bedrock API key, a short-term key signed with the AWS credentials
// (local development with an SSO profile), or plain IAM signing with the credentials (Lambda execution roles).
export type BedrockAuth =
  { kind: "api_key"; apiKey: string } | { kind: "short_term_api_key" } | { kind: "iam" };
export type BedrockConfig = { region: string; modelId: string; auth: BedrockAuth };

// Who writes the wizard drafts (#1, #2): a placeholder without an LLM, or Claude on Amazon Bedrock.
export type DraftGeneratorConfig = { mode: "dummy" } | { mode: "bedrock"; bedrock: BedrockConfig };

export class InvalidConfigError extends Error {}

export function parseBedrockConfig(environment: NodeJS.ProcessEnv): BedrockConfig {
  return {
    region: environment.BEDROCK_REGION || environment.AWS_REGION || DEFAULT_BEDROCK_REGION,
    modelId: environment.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID,
    auth: parseBedrockAuth(environment),
  };
}

function parseBedrockAuth(environment: NodeJS.ProcessEnv): BedrockAuth {
  const apiKey = environment.AWS_BEARER_TOKEN_BEDROCK;

  if (apiKey) {
    return { kind: "api_key", apiKey };
  }

  const kind = environment.BEDROCK_AUTH || "short_term_api_key";

  if (kind === "short_term_api_key" || kind === "iam") {
    return { kind };
  }

  throw new InvalidConfigError(`BEDROCK_AUTH must be "short_term_api_key" or "iam", got "${kind}"`);
}

export function parseAppConfig(environment: NodeJS.ProcessEnv): AppConfig {
  return {
    ...parseListenAddress(environment),
    database: parseDatabaseConfig(environment),
    engineVersion: environment.ENGINE_VERSION || LOCAL_ENGINE_VERSION,
    evaluationWorker: parseWorkerConfig(environment, "EVALUATION_WORKER_FUNCTION"),
    draftingWorker: parseWorkerConfig(environment, "DRAFTING_WORKER_FUNCTION"),
    draftGenerator: parseDraftGeneratorConfig(environment),
  };
}

function parseDraftGeneratorConfig(environment: NodeJS.ProcessEnv): DraftGeneratorConfig {
  const mode = environment.DRAFT_GENERATOR ?? "dummy";

  if (mode === "dummy") {
    return { mode };
  }

  if (mode === "bedrock") {
    return { mode, bedrock: parseBedrockConfig(environment) };
  }

  throw new InvalidConfigError(`DRAFT_GENERATOR must be "dummy" or "bedrock", got "${mode}"`);
}

function parseWorkerConfig(environment: NodeJS.ProcessEnv, functionVariable: string): WorkerConfig {
  const functionName = environment[functionVariable];

  if (!functionName) {
    return { mode: "in_process" };
  }

  if (!environment.AWS_REGION) {
    throw new InvalidConfigError(`AWS_REGION is required when ${functionVariable} is set`);
  }

  return { mode: "lambda", functionName, region: environment.AWS_REGION };
}

function parseListenAddress(environment: NodeJS.ProcessEnv): { host?: string; port: number } {
  const lambdaEndpoint = environment.AWS_LAMBDA_HTTP_ENDPOINT;

  if (lambdaEndpoint === undefined) {
    return { port: parsePort("PORT", environment.PORT) };
  }

  const separatorIndex = lambdaEndpoint.lastIndexOf(":");

  if (separatorIndex <= 0) {
    throw new InvalidConfigError(`AWS_LAMBDA_HTTP_ENDPOINT must be host:port, got "${lambdaEndpoint}"`);
  }

  return {
    host: lambdaEndpoint.slice(0, separatorIndex),
    port: parsePort("AWS_LAMBDA_HTTP_ENDPOINT port", lambdaEndpoint.slice(separatorIndex + 1)),
  };
}

function parsePort(name: string, rawPort: string | undefined): number {
  const port = rawPort === undefined ? DEFAULT_PORT : Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new InvalidConfigError(`${name} must be a positive integer, got "${rawPort}"`);
  }

  return port;
}

function parseDatabaseConfig(environment: NodeJS.ProcessEnv): DatabaseConfig {
  const databaseUrl = parseDatabaseUrl(environment.DATABASE_URL);
  const authMode = environment.DATABASE_AUTH ?? "password";

  if (authMode === "password") {
    return { authMode, url: databaseUrl };
  }

  if (authMode === "iam") {
    return parseIamDatabaseConfig(databaseUrl, environment.AWS_REGION);
  }

  throw new InvalidConfigError(`DATABASE_AUTH must be "password" or "iam", got "${authMode}"`);
}

function parseDatabaseUrl(rawDatabaseUrl: string | undefined): string {
  if (!rawDatabaseUrl) {
    throw new InvalidConfigError("DATABASE_URL is required, see backend/.env.example");
  }

  if (!URL.canParse(rawDatabaseUrl) || !new URL(rawDatabaseUrl).protocol.startsWith("postgres")) {
    throw new InvalidConfigError("DATABASE_URL must be a postgres:// connection string");
  }

  return rawDatabaseUrl;
}

function parseIamDatabaseConfig(databaseUrl: string, rawRegion: string | undefined): IamDatabaseConfig {
  const url = new URL(databaseUrl);
  const username = decodeURIComponent(url.username);
  const database = decodeURIComponent(url.pathname.slice(1));

  if (url.password) {
    throw new InvalidConfigError("DATABASE_URL must not contain a password when DATABASE_AUTH=iam");
  }

  if (!username || !database) {
    throw new InvalidConfigError("DATABASE_URL must name a user and a database when DATABASE_AUTH=iam");
  }

  if (!rawRegion) {
    throw new InvalidConfigError("AWS_REGION is required when DATABASE_AUTH=iam");
  }

  return {
    authMode: "iam",
    host: url.hostname,
    port: url.port ? Number(url.port) : DEFAULT_POSTGRES_PORT,
    username,
    database,
    region: rawRegion,
  };
}
