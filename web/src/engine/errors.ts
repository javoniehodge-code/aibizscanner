/** Failures that retrying cannot fix: the run fails immediately. */
export class NonRetryableError extends Error {}

export class SpendingCapError extends NonRetryableError {
  constructor(
    readonly spentUsd: number,
    readonly estimateUsd: number,
    readonly capUsd: number,
  ) {
    super(
      `Spending cap reached: spent $${spentUsd.toFixed(4)} + next call up to $${estimateUsd.toFixed(4)} would exceed the report cap of $${capUsd.toFixed(2)}`,
    );
    this.name = "SpendingCapError";
  }
}

export class MissingPricingError extends NonRetryableError {
  constructor(provider: string, model: string) {
    super(`No pricing row for ${provider}/${model}; add one before running this stage`);
    this.name = "MissingPricingError";
  }
}

export class StageTimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms} ms`);
    this.name = "StageTimeoutError";
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function isRetryable(e: unknown): boolean {
  return !(e instanceof NonRetryableError);
}
