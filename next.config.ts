import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  /** Browsers request `/favicon.ico` by default; point at generated PNG mark. */
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon/32",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
