// Entry point for the TypeORM CLI (npm run migration:*). Not imported by the app.
import "reflect-metadata";

import { parseAppConfig } from "../../config";
import { createDataSource } from "./createDataSource";

export default createDataSource(parseAppConfig(process.env).databaseUrl);
