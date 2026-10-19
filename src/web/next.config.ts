import type { NextConfig } from "next";

import { backendUrl } from "./lib/config";

const nextConfig: NextConfig = {
  // Browser calls go to /api/* on the web origin and are proxied to the backend.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
