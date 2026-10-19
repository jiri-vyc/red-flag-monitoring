import type { DataSource } from "typeorm";

import { memoizeInitialization } from "./memoizeInitialization";

function createFakeDataSource(initialize: () => Promise<DataSource>) {
  return { initialize: jest.fn(initialize) };
}

describe("memoizeInitialization", () => {
  it("initializes the data source once for concurrent and later calls", async () => {
    const dataSource = createFakeDataSource(async () => ({}) as DataSource);
    const ensureDatabaseReady = memoizeInitialization(dataSource);

    await Promise.all([ensureDatabaseReady(), ensureDatabaseReady()]);
    await ensureDatabaseReady();

    expect(dataSource.initialize).toHaveBeenCalledTimes(1);
  });

  it("retries on the next call after a failed initialization", async () => {
    const dataSource = createFakeDataSource(async () => ({}) as DataSource);
    dataSource.initialize.mockRejectedValueOnce(new Error("Aurora is resuming"));
    const ensureDatabaseReady = memoizeInitialization(dataSource);

    await expect(ensureDatabaseReady()).rejects.toThrow("Aurora is resuming");
    await expect(ensureDatabaseReady()).resolves.toBeUndefined();

    expect(dataSource.initialize).toHaveBeenCalledTimes(2);
  });
});
