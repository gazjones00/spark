ALTER TABLE "truelayer_accounts" DROP CONSTRAINT "truelayer_accounts_connection_id_truelayer_connections_id_fk";
--> statement-breakpoint
DROP INDEX "raw_provider_records_connection_resource_external_idx";--> statement-breakpoint
ALTER TABLE "truelayer_accounts" ADD CONSTRAINT "truelayer_accounts_connection_id_truelayer_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."truelayer_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "balance_snapshots_connection_account_observed_idx" ON "balance_snapshots" USING btree ("connection_id","account_external_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_snapshots_connection_account_observed_idx" ON "portfolio_snapshots" USING btree ("connection_id","account_external_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_provider_records_connection_resource_external_idx" ON "raw_provider_records" USING btree ("connection_id","resource","external_id","observed_at");