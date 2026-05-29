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

export function isTrueLayerAuthCode(code: string): boolean {
  return AUTH_ERROR_CODES.has(code as TrueLayerErrorCode);
}
