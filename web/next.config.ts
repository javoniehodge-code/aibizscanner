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
  // Both read files at run time that tracing misses (@sparticuz/chromium its compressed Chromium in bin/,
  // playwright-core its browsers.json and more): ship both packages whole with the worker.
  outputFileTracingIncludes: { "/api/worker/tick": ["./node_modules/@sparticuz/chromium/**", "./node_modules/playwright-core/**"] },
  env: {
    APP_GIT_COMMIT: buildCommit(),
  },
};

export default nextConfig;
