import { z } from "zod";

/**
 * Derived, estimate-based consent state for a connection. `EXPIRING_SOON` is
 * a soft prompt computed from local columns only — it never claims the
 * consent has actually expired (terminal expiry stays a real auth failure
 * surfacing as `NEEDS_REAUTH`) and never stops syncing.
 */
export const ConsentStatus = {
  ACTIVE: "ACTIVE",
  EXPIRING_SOON: "EXPIRING_SOON",
} as const;

export const ConsentStatusSchema = z
  .enum([ConsentStatus.ACTIVE, ConsentStatus.EXPIRING_SOON])
  .meta({ id: "ConsentStatus" });

export type ConsentStatusType = z.infer<typeof ConsentStatusSchema>;

/**
 * Payload for the `consent.expiring` event produced by the consent lifecycle
 * job and consumed by the outbound notification channel. Identifiers and
 * timestamps only — no tokens, no account numbers, no PII.
 */
export const ConsentExpiringEventSchema = z
  .strictObject({
    userId: z.string().min(1),
    connectionId: z.string().min(1),
    providerId: z.string().min(1),
    providerName: z.string().min(1),
    consentExpiresAt: z.iso.datetime(),
  })
  .meta({ id: "ConsentExpiringEvent" });

export type ConsentExpiringEvent = z.infer<typeof ConsentExpiringEventSchema>;
