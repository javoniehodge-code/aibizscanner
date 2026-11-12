/** Git commit the running build came from. Vercel sets VERCEL_GIT_COMMIT_SHA; next.config.ts falls back to `git rev-parse`. */
export function gitCommit(): string | null {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_GIT_COMMIT || "";
  return sha.length > 0 ? sha : null;
}
