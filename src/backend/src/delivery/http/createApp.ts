import express, { type Express } from "express";

import { errorHandler, notFoundHandler } from "./errorHandler";
import { createHealthRouter } from "./healthRouter";

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use("/api/health", createHealthRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
