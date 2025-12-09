import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    "src/app/api/**": [
      "node_modules/@prisma/client/**",
      "node_modules/.prisma/**"
    ]
  }
};

export default nextConfig;