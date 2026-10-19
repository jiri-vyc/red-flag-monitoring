import { z } from "zod";

export const databaseStatusSchema = z.object({
  databaseName: z.string(),
  serverAddress: z.string().nullable(),
  serverVersion: z.string(),
  auroraVersion: z.string().nullable(),
  serverTime: z.string(),
  latestMigration: z.string().nullable(),
  clientCount: z.number(),
});
export type DatabaseStatus = z.infer<typeof databaseStatusSchema>;
