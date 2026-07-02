import { TRUELAYER_PROVIDER_ID } from "@spark/connectors";
import { ConsentStatus, type ConsentStatusType } from "@spark/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Expected consent lifetime per provider, in days. These are ESTIMATES of the
 * provider- and regime-dependent reconfirmation window, not regulatory
 * constants — they exist only to warn the user before a connection is likely
 * to stop refreshing. Providers absent from this map (e.g. API-key connectors
 * with no consent clock) get a null expiry and are never flagged.
 */
const CONSENT_LIFETIME_DAYS: Readonly<Record<string, number>> = {
  [TRUELAYER_PROVIDER_ID]: 90,
};

/** How far ahead of the estimated expiry the "reconnect soon" prompt starts. */
export const CONSENT_WARNING_WINDOW_DAYS = 14;

export function consentExpiryFor(providerId: string, grantedAt: Date): Date | null {
  const lifetimeDays = CONSENT_LIFETIME_DAYS[providerId];
  if (lifetimeDays === undefined) {
    return null;
  }
  return new Date(grantedAt.getTime() + lifetimeDays * DAY_MS);
}

/**
 * Pure local derivation (no provider calls): EXPIRING_SOON iff an expiry
 * estimate exists and falls within the warning window. A past estimate stays
 * EXPIRING_SOON — never "expired" — because it is only an estimate; terminal
 * expiry is a real auth failure surfacing as NEEDS_REAUTH.
 */
export function deriveConsentStatus(
  consentExpiresAt: Date | null,
  now: Date = new Date(),
): ConsentStatusType {
  if (
    consentExpiresAt !== null &&
    consentExpiresAt.getTime() <= now.getTime() + CONSENT_WARNING_WINDOW_DAYS * DAY_MS
  ) {
    return ConsentStatus.EXPIRING_SOON;
  }
  return ConsentStatus.ACTIVE;
}
