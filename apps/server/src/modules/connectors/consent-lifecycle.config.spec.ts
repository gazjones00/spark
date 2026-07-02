import { TRUELAYER_PROVIDER_ID } from "@spark/connectors";
import { ConsentStatus } from "@spark/schema";
import { describe, expect, it } from "vitest";
import {
  CONSENT_WARNING_WINDOW_DAYS,
  consentExpiryFor,
  deriveConsentStatus,
} from "./consent-lifecycle.config";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-02T12:00:00.000Z");

describe("consentExpiryFor", () => {
  it("returns grant time plus the configured lifetime for a known provider", () => {
    const expiry = consentExpiryFor(TRUELAYER_PROVIDER_ID, NOW);
    expect(expiry).toEqual(new Date(NOW.getTime() + 90 * DAY_MS));
  });

  it("returns null for a provider with no configured lifetime", () => {
    // API-key connectors (e.g. Trading 212) have no consent clock; a null
    // expiry means the connection is never flagged.
    expect(consentExpiryFor("trading212", NOW)).toBeNull();
    expect(consentExpiryFor("unknown-provider", NOW)).toBeNull();
  });
});

describe("deriveConsentStatus", () => {
  const cases: Array<{ name: string; expiresAt: Date | null; expected: string }> = [
    { name: "null expiry (unknown lifetime)", expiresAt: null, expected: ConsentStatus.ACTIVE },
    {
      name: "far-future expiry (outside the window)",
      expiresAt: new Date(NOW.getTime() + (CONSENT_WARNING_WINDOW_DAYS + 1) * DAY_MS),
      expected: ConsentStatus.ACTIVE,
    },
    {
      name: "expiry inside the warning window",
      expiresAt: new Date(NOW.getTime() + (CONSENT_WARNING_WINDOW_DAYS - 1) * DAY_MS),
      expected: ConsentStatus.EXPIRING_SOON,
    },
    {
      // An estimate in the past is still only an estimate — never rendered
      // as "expired"; terminal expiry stays a real NEEDS_REAUTH failure.
      name: "expiry in the past",
      expiresAt: new Date(NOW.getTime() - DAY_MS),
      expected: ConsentStatus.EXPIRING_SOON,
    },
  ];

  for (const { name, expiresAt, expected } of cases) {
    it(`${name} → ${expected}`, () => {
      expect(deriveConsentStatus(expiresAt, NOW)).toBe(expected);
    });
  }
});
