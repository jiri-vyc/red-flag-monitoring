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

export type AppConfig = { host?: string; port: number; database: DatabaseConfig };

// apiKey is null when no Bedrock API key is configured; a short-term key is then generated from AWS credentials.
export type BedrockConfig = { region: string; modelId: string; apiKey: string | null };

export class InvalidConfigError extends Error {}

export function parseBedrockConfig(environment: NodeJS.ProcessEnv): BedrockConfig {
  return {
    region: environment.BEDROCK_REGION || environment.AWS_REGION || DEFAULT_BEDROCK_REGION,
    modelId: environment.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID,
    apiKey: environment.AWS_BEARER_TOKEN_BEDROCK || null,
  };
}

export function parseAppConfig(environment: NodeJS.ProcessEnv): AppConfig {
  return {
    ...parseListenAddress(environment),
    database: parseDatabaseConfig(environment),
  };
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
