import { SyncStatus } from "@spark/common";
import { consentExpiryFor } from "./consent-lifecycle.config";

/**
 * The columns that together say "this connection is not in a failure state".
 * Every path back to health has to clear all four: a surviving
 * lastSyncErrorCode reads as a healthy connection carrying a live error, and a
 * surviving consecutiveFailures count re-trips the breaker on the next single
 * failure. Written on a successful sync and on a reconnect, so the set lives
 * here rather than in each writer.
 */
export function clearedSyncFailure() {
  return {
    syncStatus: SyncStatus.OK,
    consecutiveFailures: 0,
    lastSyncErrorCode: null,
    lastSyncErrorMessage: null,
  };
}

/**
 * The consent clock for a grant made now. Warning stamp included: it belongs
 * to the cycle just replaced, and leaving it set would suppress the expiry
 * prompt for the new consent's whole lifetime.
 */
export function grantedConsent(providerId: string, now: Date) {
  return {
    consentGrantedAt: now,
    consentExpiresAt: consentExpiryFor(providerId, now),
    consentWarningIssuedAt: null,
  };
}
