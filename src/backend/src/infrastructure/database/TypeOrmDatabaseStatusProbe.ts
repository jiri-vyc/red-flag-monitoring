import type { DataSource } from "typeorm";

import type {
  DatabaseStatus,
  DatabaseStatusProbe,
} from "../../application/databaseStatus/databaseStatusProbe";

type ServerIdentityRow = Omit<DatabaseStatus, "auroraVersion"> & { isAurora: boolean };

const SELECT_SERVER_IDENTITY = `
  -- Which server and database the backend is connected to, and whether the app schema and data are there
  SELECT current_database() AS "databaseName",
         host(inet_server_addr()) AS "serverAddress",
         version() AS "serverVersion",
         now() AS "serverTime",
         (SELECT "name" FROM "migrations" ORDER BY "timestamp" DESC LIMIT 1) AS "latestMigration",
         (SELECT count(*)::int FROM "clients") AS "clientCount",
         to_regproc('aurora_version') IS NOT NULL AS "isAurora"
`;

// aurora_version() exists only on Aurora; plain PostgreSQL rejects any query naming it, so it stays separate.
const SELECT_AURORA_VERSION = `SELECT aurora_version() AS "auroraVersion"`;

export class TypeOrmDatabaseStatusProbe implements DatabaseStatusProbe {
  constructor(private readonly dataSource: DataSource) {}

  async loadDatabaseStatus(): Promise<DatabaseStatus> {
    const [serverIdentity] = await this.dataSource.query<ServerIdentityRow[]>(SELECT_SERVER_IDENTITY);

    if (!serverIdentity) {
      throw new Error("Server identity query returned no row");
    }

    const { isAurora, ...status } = serverIdentity;

    return { ...status, auroraVersion: isAurora ? await this.loadAuroraVersion() : null };
  }

  private async loadAuroraVersion(): Promise<string | null> {
    const [row] = await this.dataSource.query<{ auroraVersion: string }[]>(SELECT_AURORA_VERSION);

    return row?.auroraVersion ?? null;
  }
}
