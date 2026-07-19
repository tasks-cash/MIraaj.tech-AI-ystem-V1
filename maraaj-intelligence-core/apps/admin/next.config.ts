
import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin tracing to this monorepo — a parent lockfile otherwise confuses Next.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000" },
      { protocol: "http", hostname: "localhost", port: "9100" },
      { protocol: "https", hostname: "media.maraaj.tech" },
    ],
  },
};

export default nextConfig;
