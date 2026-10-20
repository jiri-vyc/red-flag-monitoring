import { z } from "zod";

const apiModeSchema = z.enum(["mock", "live"]);
const optionalApiModeSchema = apiModeSchema.optional();

export type ApiMode = z.infer<typeof apiModeSchema>;

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_MODE: apiModeSchema.default("mock"),
  NEXT_PUBLIC_API_MODE_REGULATIONS: optionalApiModeSchema,
  NEXT_PUBLIC_API_MODE_POLICIES: optionalApiModeSchema,
  NEXT_PUBLIC_API_MODE_RULES: optionalApiModeSchema,
  NEXT_PUBLIC_API_MODE_BATCHES: optionalApiModeSchema,
  NEXT_PUBLIC_API_MODE_WIZARD: optionalApiModeSchema,
  NEXT_PUBLIC_API_MODE_DASHBOARD: optionalApiModeSchema,
  NEXT_PUBLIC_API_MODE_USERS: optionalApiModeSchema,
  NEXT_PUBLIC_API_MODE_TRANSACTIONS: optionalApiModeSchema,
  NEXT_PUBLIC_API_MODE_FAU_REPORTS: optionalApiModeSchema,
});

// Next.js inlines NEXT_PUBLIC_* only for literal `process.env.X` references, so each one is listed explicitly.
const rawClientEnv = {
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
  NEXT_PUBLIC_API_MODE_REGULATIONS: process.env.NEXT_PUBLIC_API_MODE_REGULATIONS,
  NEXT_PUBLIC_API_MODE_POLICIES: process.env.NEXT_PUBLIC_API_MODE_POLICIES,
  NEXT_PUBLIC_API_MODE_RULES: process.env.NEXT_PUBLIC_API_MODE_RULES,
  NEXT_PUBLIC_API_MODE_BATCHES: process.env.NEXT_PUBLIC_API_MODE_BATCHES,
  NEXT_PUBLIC_API_MODE_WIZARD: process.env.NEXT_PUBLIC_API_MODE_WIZARD,
  NEXT_PUBLIC_API_MODE_DASHBOARD: process.env.NEXT_PUBLIC_API_MODE_DASHBOARD,
  NEXT_PUBLIC_API_MODE_USERS: process.env.NEXT_PUBLIC_API_MODE_USERS,
  NEXT_PUBLIC_API_MODE_TRANSACTIONS: process.env.NEXT_PUBLIC_API_MODE_TRANSACTIONS,
  NEXT_PUBLIC_API_MODE_FAU_REPORTS: process.env.NEXT_PUBLIC_API_MODE_FAU_REPORTS,
};

function parseClientEnv() {
  const parseResult = clientEnvSchema.safeParse(rawClientEnv);
  if (!parseResult.success) {
    throw new Error(`Invalid client environment: ${z.prettifyError(parseResult.error)}`);
  }
  return parseResult.data;
}

export const clientEnv = parseClientEnv();
