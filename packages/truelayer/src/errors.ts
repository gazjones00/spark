import type { TrueLayerErrorCode, TrueLayerErrorResponse } from "./types.ts";

/**
 * OAuth-style error codes that signal the consent/grant is gone and the user
 * must reconnect. `invalid_request` and `server_error` are deliberately
 * excluded — they are transient/caller errors, not consent failures.
 */
const AUTH_ERROR_CODES = new Set<TrueLayerErrorCode>([
  "access_denied",
  "invalid_grant",
  "invalid_client",
  "unauthorized_client",
]);

export class TrueLayerError extends Error {
  readonly code: TrueLayerErrorCode;
  readonly description: string | undefined;

  constructor(code: TrueLayerErrorCode, description?: string) {
    super(description ?? code);
    this.name = "TrueLayerError";
    this.code = code;
    this.description = description;
  }

  static fromResponse(response: TrueLayerErrorResponse): TrueLayerError {
    return new TrueLayerError(response.error as TrueLayerErrorCode, response.error_description);
  }
}

/**
 * A terminal authentication failure from a TrueLayer data endpoint: either an
 * HTTP 401/403 (typically a bank-side consent revocation, which arrives even
 * while our locally-stored token is still valid) or an OAuth error code that
 * means the grant is no longer usable. The sync layer maps this to
 * `NEEDS_REAUTH` so the account stops being retried and the user is prompted
 * to reconnect.
 */
export class TrueLayerAuthError extends TrueLayerError {
  readonly status: number | undefined;

  constructor(code: TrueLayerErrorCode, description?: string, status?: number) {
    super(code, description);
    this.name = "TrueLayerAuthError";
    this.status = status;
  }
}

/**
 * HTTP 429 from any TrueLayer endpoint. Transient with an explicit backoff
 * deadline: `retryAfterMs` carries the provider's `Retry-After` /
 * `X-RateLimit-Reset` hint (null when the response had neither), so the sync
 * layer can reschedule on the provider's schedule instead of the generic
 * exponential backoff.
 */
export class TrueLayerRateLimitError extends TrueLayerError {
  readonly status = 429;
  readonly retryAfterMs: number | null;

  constructor(retryAfterMs: number | null, description?: string) {
    super("rate_limit_exceeded", description ?? "TrueLayer rate limit exceeded");
    this.name = "TrueLayerRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export function isTrueLayerAuthCode(code: string): boolean {
  return AUTH_ERROR_CODES.has(code as TrueLayerErrorCode);
}
