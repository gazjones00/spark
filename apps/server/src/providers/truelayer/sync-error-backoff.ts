import { SyncStatus, type SyncStatusType } from "@spark/common";
import { TrueLayerRateLimitError } from "@spark/truelayer/server";
import { syncStatusFromError } from "./sync-status-from-error";

// Transient non-rate-limit ERRORs are retried by the scheduler after this backoff.
const ERROR_RETRY_MS = 30 * 60 * 1000;
const RATE_LIMIT_DEFAULT_BACKOFF_MS = 60_000;
const RATE_LIMIT_MIN_BACKOFF_MS = 1_000;
const RATE_LIMIT_MAX_BACKOFF_MS = 3_600_000;
const BACKOFF_JITTER_RATIO = 0.1;

export interface SyncErrorBackoff {
  status: SyncStatusType;
  nextSyncAt?: Date;
  backoffMs?: number;
  rateLimitRetryAfterMs?: number | null;
}

export function syncErrorBackoff(error: unknown, now: number = Date.now()): SyncErrorBackoff {
  const status = syncStatusFromError(error);
  if (status !== SyncStatus.ERROR) {
    return { status };
  }

  const rateLimit = findTrueLayerRateLimitError(error);
  const backoffMs = rateLimit ? rateLimitBackoffMs(rateLimit.retryAfterMs) : ERROR_RETRY_MS;

  return {
    status,
    nextSyncAt: new Date(now + backoffMs),
    backoffMs,
    ...(rateLimit ? { rateLimitRetryAfterMs: rateLimit.retryAfterMs } : {}),
  };
}

function rateLimitBackoffMs(retryAfterMs: number | null): number {
  const hinted = retryAfterMs ?? RATE_LIMIT_DEFAULT_BACKOFF_MS;
  const clamped = Math.min(Math.max(hinted, RATE_LIMIT_MIN_BACKOFF_MS), RATE_LIMIT_MAX_BACKOFF_MS);
  return Math.round(clamped * (1 + Math.random() * BACKOFF_JITTER_RATIO));
}

function findTrueLayerRateLimitError(error: unknown): TrueLayerRateLimitError | undefined {
  let current = error;
  const seen = new Set<unknown>();

  while (current && typeof current === "object" && !seen.has(current)) {
    if (current instanceof TrueLayerRateLimitError) {
      return current;
    }
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
  }

  return undefined;
}
