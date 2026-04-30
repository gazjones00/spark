ALTER TABLE "connector_connections" ADD COLUMN "sync_status" text DEFAULT 'OK' NOT NULL;--> statement-breakpoint
ALTER TABLE "connector_connections" ADD COLUMN "next_sync_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "connector_connections" ADD COLUMN "last_sync_error_code" text;--> statement-breakpoint
ALTER TABLE "connector_connections" ADD COLUMN "last_sync_error_message" text;--> statement-breakpoint
CREATE INDEX "connector_connections_next_sync_idx" ON "connector_connections" USING btree ("sync_status","next_sync_at");