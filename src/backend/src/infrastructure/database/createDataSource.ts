import path from "node:path";

import { DataSource } from "typeorm";

// Globs match .ts when run via tsx (dev, CLI) and .js when run from dist/.
const ENTITIES_GLOB = path.join(__dirname, "entities", "*.{ts,js}");
const MIGRATIONS_GLOB = path.join(__dirname, "migrations", "*.{ts,js}");

export function createDataSource(databaseUrl: string): DataSource {
  return new DataSource({
    type: "postgres",
    url: databaseUrl,
    entities: [ENTITIES_GLOB],
    migrations: [MIGRATIONS_GLOB],
    // gen_random_uuid() from pgcrypto, installed by the InitialSchema migration.
    uuidExtension: "pgcrypto",
    // Schema changes go through migrations only.
    synchronize: false,
  });
}
