import path from "node:path";

import type { NextConfig } from "next";

import { parseServerEnv } from "./config/serverEnvSchema";

const { BACKEND_URL } = parseServerEnv(process.env);

const nextConfig: NextConfig = {
  output: "standalone",
  // npm workspace: next and react are hoisted to src/node_modules.
  outputFileTracingRoot: path.join(__dirname, ".."),
  // Browser calls go to /api/* on the web origin and are proxied to the backend.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
