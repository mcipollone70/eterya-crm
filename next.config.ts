import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // L'import wizard invia le righe pulite dell'Excel alla Server Action.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
