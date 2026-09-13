import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tourist/protocol", "@tourist/world-generator"],
};

export default nextConfig;
