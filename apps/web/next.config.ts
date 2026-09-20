import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The workspace packages ship TypeScript source, not build output.
  transpilePackages: ["@premium/core", "@premium/db"],
  poweredByHeader: false,
};

export default config;
