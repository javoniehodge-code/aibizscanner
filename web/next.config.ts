import type { NextConfig } from "next";
import { execSync } from "node:child_process";

function buildCommit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The JavaScript check's headless browser (src/worker/renderer.ts): loaded at run time by the worker, not bundled.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  // @sparticuz/chromium reads its compressed Chromium from its bin/ folder at run time; make sure the worker ships it.
  outputFileTracingIncludes: { "/api/worker/tick": ["./node_modules/@sparticuz/chromium/bin/**"] },
  env: {
    APP_GIT_COMMIT: buildCommit(),
  },
};

export default nextConfig;
