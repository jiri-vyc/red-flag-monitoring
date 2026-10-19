import "reflect-metadata";

import { parseAppConfig } from "./config";
import { createApp } from "./delivery/http/createApp";
import { createDataSource } from "./infrastructure/database/createDataSource";

async function startServer(): Promise<void> {
  const appConfig = parseAppConfig(process.env);
  const dataSource = createDataSource(appConfig.databaseUrl);

  await dataSource.initialize();

  const app = createApp();

  app.listen(appConfig.port, () => {
    console.log(`Backend listening on http://localhost:${appConfig.port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Backend failed to start", error);
  process.exit(1);
});
