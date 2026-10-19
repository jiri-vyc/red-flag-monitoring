import "reflect-metadata";

import { parseAppConfig } from "./config";
import { createApp } from "./delivery/http/createApp";

const appConfig = parseAppConfig(process.env);
const app = createApp();

app.listen(appConfig.port, () => {
  console.log(`Backend listening on http://localhost:${appConfig.port}`);
});
