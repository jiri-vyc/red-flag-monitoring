import { z } from "zod";

// Kept free of `server-only` so next.config.ts (plain Node, outside React) can reuse the same validation.
const serverEnvSchema = z.object({
  BACKEND_URL: z.url().default("http://localhost:4000"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(rawEnv: Record<string, string | undefined>): ServerEnv {
  const parseResult = serverEnvSchema.safeParse(rawEnv);
  if (!parseResult.success) {
    throw new Error(`Invalid server environment: ${z.prettifyError(parseResult.error)}`);
  }
  return parseResult.data;
}
