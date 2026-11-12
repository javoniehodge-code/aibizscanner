import type { Pricing, Usage } from "./types";

/** Estimated USD for one call, rounded to 6 decimals (the database column precision). */
export function estimateCostUsd(pricing: Pricing, usage: Usage): number {
  const usd =
    (usage.tokensIn / 1_000_000) * pricing.inputUsdPerMtok +
    (usage.tokensOut / 1_000_000) * pricing.outputUsdPerMtok +
    usage.searchCalls * pricing.searchUsdPerCall +
    usage.requests * pricing.requestUsdPerCall;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/** Exponential backoff before the next attempt, after `failedAttempts` failures: 15s, 30s, 60s … capped at 10 min. */
export function backoffMs(failedAttempts: number, baseMs = 15_000, maxMs = 600_000): number {
  const n = Math.max(1, Math.floor(failedAttempts));
  return Math.min(maxMs, baseMs * 2 ** (n - 1));
}
