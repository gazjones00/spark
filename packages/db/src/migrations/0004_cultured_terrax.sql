CREATE TABLE "balance_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"account_external_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"currency" text NOT NULL,
	"cash" numeric(19, 4) NOT NULL,
	"available_cash" numeric(19, 4),
	"blocked_cash" numeric(19, 4),
	"invested" numeric(19, 4),
	"total" numeric(19, 4) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_name" text NOT NULL,
	"environment" text NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"credential_key_id" text NOT NULL,
	"capabilities" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_sync_cursors" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"resource" text NOT NULL,
	"cursor" text,
	"checkpoint" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"status" text NOT NULL,
	"records_read" integer DEFAULT 0 NOT NULL,
	"records_written" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"external_id" text NOT NULL,
	"type" text NOT NULL,
	"display_name" text NOT NULL,
	"currency" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"account_external_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"external_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"description" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"currency" text NOT NULL,
	"instrument_external_id" text,
	"quantity" numeric(24, 8),
	"price" numeric(19, 8),
	"fees" numeric(19, 4),
	"tax" numeric(19, 4),
	"fx_rate" numeric(19, 8),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"account_external_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"external_id" text NOT NULL,
	"instrument_external_id" text NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"available_quantity" numeric(24, 8),
	"average_price" numeric(19, 8),
	"current_price" numeric(19, 8),
	"currency" text NOT NULL,
	"value" numeric(19, 4),
	"cost_basis" numeric(19, 4),
	"unrealized_profit_loss" numeric(19, 4),
	"observed_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"external_id" text NOT NULL,
	"ticker" text NOT NULL,
	"name" text,
	"isin" text,
	"currency" text,
	"type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"account_external_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"currency" text NOT NULL,
	"cash_value" numeric(19, 4) NOT NULL,
	"investment_value" numeric(19, 4) NOT NULL,
	"total_value" numeric(19, 4) NOT NULL,
	"cost_basis" numeric(19, 4),
	"realized_profit_loss" numeric(19, 4),
	"unrealized_profit_loss" numeric(19, 4),
	"observed_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_provider_records" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"resource" text NOT NULL,
	"external_id" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_connections" ADD CONSTRAINT "connector_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_sync_cursors" ADD CONSTRAINT "connector_sync_cursors_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_sync_runs" ADD CONSTRAINT "connector_sync_runs_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_sync_runs" ADD CONSTRAINT "connector_sync_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_provider_records" ADD CONSTRAINT "raw_provider_records_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_snapshots_connection_observed_idx" ON "balance_snapshots" USING btree ("connection_id","observed_at");--> statement-breakpoint
CREATE INDEX "connector_connections_user_id_idx" ON "connector_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connector_connections_provider_id_idx" ON "connector_connections" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_sync_cursors_connection_resource_idx" ON "connector_sync_cursors" USING btree ("connection_id","resource");--> statement-breakpoint
CREATE INDEX "connector_sync_runs_connection_id_idx" ON "connector_sync_runs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "connector_sync_runs_user_id_idx" ON "connector_sync_runs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_accounts_connection_external_idx" ON "financial_accounts" USING btree ("connection_id","external_id");--> statement-breakpoint
CREATE INDEX "financial_accounts_user_id_idx" ON "financial_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_transactions_connection_external_idx" ON "financial_transactions" USING btree ("connection_id","external_id");--> statement-breakpoint
CREATE INDEX "financial_transactions_connection_id_idx" ON "financial_transactions" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "financial_transactions_account_external_id_idx" ON "financial_transactions" USING btree ("account_external_id");--> statement-breakpoint
CREATE INDEX "financial_transactions_occurred_at_idx" ON "financial_transactions" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "holdings_connection_external_idx" ON "holdings" USING btree ("connection_id","external_id");--> statement-breakpoint
CREATE INDEX "holdings_connection_id_idx" ON "holdings" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instruments_provider_external_idx" ON "instruments" USING btree ("provider_id","external_id");--> statement-breakpoint
CREATE INDEX "instruments_ticker_idx" ON "instruments" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "instruments_isin_idx" ON "instruments" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "portfolio_snapshots_connection_observed_idx" ON "portfolio_snapshots" USING btree ("connection_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_provider_records_connection_resource_external_idx" ON "raw_provider_records" USING btree ("connection_id","resource","external_id");--> statement-breakpoint
CREATE INDEX "raw_provider_records_connection_id_idx" ON "raw_provider_records" USING btree ("connection_id");