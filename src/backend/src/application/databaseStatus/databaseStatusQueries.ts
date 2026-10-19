import type { DatabaseStatus, DatabaseStatusProbe } from "./databaseStatusProbe";

export class DatabaseStatusQueries {
  constructor(private readonly databaseStatusProbe: DatabaseStatusProbe) {}

  loadDatabaseStatus(): Promise<DatabaseStatus> {
    return this.databaseStatusProbe.loadDatabaseStatus();
  }
}
