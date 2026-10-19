const DEFAULT_PORT = 4000;

export type AppConfig = { port: number };

export class InvalidConfigError extends Error {}

export function parseAppConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const port = environment.PORT === undefined ? DEFAULT_PORT : Number(environment.PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new InvalidConfigError(`PORT must be a positive integer, got "${environment.PORT}"`);
  }

  return { port };
}
