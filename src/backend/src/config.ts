const DEFAULT_PORT = 4000;

export type AppConfig = { port: number; databaseUrl: string };

export class InvalidConfigError extends Error {}

export function parseAppConfig(environment: NodeJS.ProcessEnv): AppConfig {
  return {
    port: parsePort(environment.PORT),
    databaseUrl: parseDatabaseUrl(environment.DATABASE_URL),
  };
}

function parsePort(rawPort: string | undefined): number {
  const port = rawPort === undefined ? DEFAULT_PORT : Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new InvalidConfigError(`PORT must be a positive integer, got "${rawPort}"`);
  }

  return port;
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
