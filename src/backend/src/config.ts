const DEFAULT_PORT = 4000;
const DEFAULT_POSTGRES_PORT = 5432;

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

export type AppConfig = { port: number; database: DatabaseConfig };

export class InvalidConfigError extends Error {}

export function parseAppConfig(environment: NodeJS.ProcessEnv): AppConfig {
  return {
    port: parsePort(environment.PORT),
    database: parseDatabaseConfig(environment),
  };
}

function parsePort(rawPort: string | undefined): number {
  const port = rawPort === undefined ? DEFAULT_PORT : Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new InvalidConfigError(`PORT must be a positive integer, got "${rawPort}"`);
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
