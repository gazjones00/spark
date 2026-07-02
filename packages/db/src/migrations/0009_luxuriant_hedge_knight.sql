ALTER TABLE "connector_connections" ADD COLUMN "consent_granted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connector_connections" ADD COLUMN "consent_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connector_connections" ADD COLUMN "consent_warning_issued_at" timestamp with time zone;--> statement-breakpoint
-- Backfill existing consent-bound (OAuth) connections from creation time so
-- long-lived connections get warned rather than silently exempted. 90 days is
-- the configured TrueLayer lifetime estimate at migration time (see
-- apps/server/src/modules/connectors/consent-lifecycle.config.ts); providers
-- without a configured lifetime keep NULL and are never flagged.
UPDATE "connector_connections"
SET "consent_granted_at" = "created_at",
    "consent_expires_at" = "created_at" + interval '90 days'
WHERE "provider_id" = 'truelayer' AND "consent_granted_at" IS NULL;