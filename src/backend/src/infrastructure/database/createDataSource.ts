import path from "node:path";

import { DataSource } from "typeorm";

import type { DatabaseConfig } from "../../config";
import { createIamConnectionOptions, createRdsAuthTokenGenerator } from "./iamConnectionOptions";

// Globs match .ts when run via tsx (dev, CLI) and .js when run from dist/.
const ENTITIES_GLOB = path.join(__dirname, "entities", "*.{ts,js}");
const MIGRATIONS_GLOB = path.join(__dirname, "migrations", "*.{ts,js}");

export function createDataSource(databaseConfig: DatabaseConfig): DataSource {
  return new DataSource({
    type: "postgres",
    ...createConnectionOptions(databaseConfig),
    entities: [ENTITIES_GLOB],
    migrations: [MIGRATIONS_GLOB],
    // gen_random_uuid() from pgcrypto, installed by the InitialSchema migration.
    uuidExtension: "pgcrypto",
    // Schema changes go through migrations only.
    synchronize: false,
  });
}

function createConnectionOptions(databaseConfig: DatabaseConfig) {
  if (databaseConfig.authMode === "password") {
    return { url: databaseConfig.url };
  }

  // No url here: TypeORM would turn its missing password into "" and override the token generator.
  return createIamConnectionOptions(databaseConfig, createRdsAuthTokenGenerator(databaseConfig));
}
