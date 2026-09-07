import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/amazon-category-selection-center', destination: '/amazon-category-selection-center.html', permanent: true },
      { source: '/amazon-category-selection-center/raw', destination: '/amazon-category-selection-center.html', permanent: true },
    ]
  },
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    "src/app/api/**": [
      "node_modules/@prisma/client/**",
      "node_modules/.prisma/**"
    ]
  }
};

export default nextConfig;
