import "server-only";

import { parseServerEnv } from "./serverEnvSchema";

export const serverEnv = parseServerEnv(process.env);
