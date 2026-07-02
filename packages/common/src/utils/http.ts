/** Default total-request deadline for upstream provider calls. */
export const DEFAULT_HTTP_TIMEOUT_MS = 15_000;

/**
 * A request exceeded its total-request deadline. Transient by nature: the
 * caller's error taxonomy should map it to a retryable class.
 */
export class HttpTimeoutError extends Error {
  readonly code = "HTTP_TIMEOUT";

  constructor(url: string, timeoutMs: number) {
    super(`Request to ${new URL(url).origin} timed out after ${timeoutMs}ms`);
    this.name = "HttpTimeoutError";
  }
}

export interface ResilientFetchOptions extends RequestInit {
  /** Total-request deadline; defaults to DEFAULT_HTTP_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Injectable for tests; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

/**
 * `fetch` with a hard total-request timeout via AbortController. Bun/Node
 * fetch has no default deadline, so a stalled upstream socket would
 * otherwise pin its worker slot forever. Timeouts surface as
 * `HttpTimeoutError`; every other failure is passed through untouched.
 */
export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_HTTP_TIMEOUT_MS, fetchFn = fetch, ...init } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new HttpTimeoutError(url, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves a provider's rate-limit backoff hint to a relative delay in
 * milliseconds. Reads `Retry-After` (delta-seconds or HTTP-date, RFC 9110
 * §10.2.3) first, then `X-RateLimit-Reset` (epoch seconds). Returns `null`
 * when neither header is present or parseable — callers apply their own
 * bounded default. The parser is pure and unclamped; clamping/jitter is the
 * caller's policy.
 */
export function parseRetryAfterMs(headers: Headers, now: number = Date.now()): number | null {
  const retryAfter = headers.get("retry-after");
  if (retryAfter !== null) {
    const trimmed = retryAfter.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed) * 1000;
    }
    const date = Date.parse(trimmed);
    if (!Number.isNaN(date)) {
      return date - now;
    }
  }

  const reset = headers.get("x-ratelimit-reset");
  if (reset !== null && /^\d+$/.test(reset.trim())) {
    return Number(reset.trim()) * 1000 - now;
  }

  return null;
}
