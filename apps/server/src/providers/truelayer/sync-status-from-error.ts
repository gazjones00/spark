import { SyncStatus, type SyncStatusType } from "@spark/common";
import { TrueLayerAuthError } from "@spark/truelayer/server";
import { TokenExpiredError } from "./truelayer.connection.service";

/**
 * Single source of truth for turning a sync failure into a {@link SyncStatus}.
 *
 * Both `NEEDS_REAUTH` signals are terminal and must stop auto-retries:
 * - `TokenExpiredError` — our local token expired with no refresh token.
 * - `TrueLayerAuthError` — a bank-side 401/403 or auth/consent OAuth code.
 *
 * Everything else (timeouts, 5xx, 429, schema-parse errors) is transient and
 * maps to `ERROR`, which the schedulers retry after a backoff.
 */
export function syncStatusFromError(error: unknown): SyncStatusType {
  if (error instanceof TokenExpiredError) {
    return SyncStatus.NEEDS_REAUTH;
  }
  if (error instanceof TrueLayerAuthError) {
    return SyncStatus.NEEDS_REAUTH;
  }
  return SyncStatus.ERROR;
}
