import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the Python render engine with every API function so it can be copied into Vercel Sandboxes.
  outputFileTracingIncludes: {
    "/api/**/*": ["./engine/**/*"],
  },
  outputFileTracingExcludes: {
    "/api/**/*": ["./engine/**/__pycache__/**", "./engine/**/*.pyc"],
  },
  images: { unoptimized: true },
  serverExternalPackages: ["@vercel/sandbox"],
};

export default nextConfig;
