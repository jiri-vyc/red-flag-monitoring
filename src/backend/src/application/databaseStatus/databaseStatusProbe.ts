export type DatabaseStatus = {
  databaseName: string;
  serverAddress: string | null;
  serverVersion: string;
  auroraVersion: string | null;
  serverTime: Date;
  latestMigration: string | null;
  clientCount: number;
};

export interface DatabaseStatusProbe {
  loadDatabaseStatus(): Promise<DatabaseStatus>;
}
