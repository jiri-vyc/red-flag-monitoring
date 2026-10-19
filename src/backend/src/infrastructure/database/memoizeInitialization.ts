import type { DataSource } from "typeorm";

export type EnsureDatabaseReady = () => Promise<void>;

export function memoizeInitialization(dataSource: Pick<DataSource, "initialize">): EnsureDatabaseReady {
  let initialization: Promise<void> | undefined;

  return () => {
    initialization ??= dataSource.initialize().then(
      () => undefined,
      (error: unknown) => {
        initialization = undefined;
        throw error;
      },
    );

    return initialization;
  };
}
