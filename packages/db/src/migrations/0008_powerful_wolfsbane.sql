CREATE TABLE "account_daily_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"account_external_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"day" date NOT NULL,
	"currency" text NOT NULL,
	"end_of_day_balance" numeric(19, 4) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_daily_rollups" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"account_external_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"day" date NOT NULL,
	"currency" text NOT NULL,
	"category" text NOT NULL,
	"debit_total" numeric(19, 4) NOT NULL,
	"credit_total" numeric(19, 4) NOT NULL,
	"transaction_count" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "financial_transactions_account_external_id_idx";--> statement-breakpoint
ALTER TABLE "account_daily_balances" ADD CONSTRAINT "account_daily_balances_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_daily_balances" ADD CONSTRAINT "account_daily_balances_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_daily_rollups" ADD CONSTRAINT "transaction_daily_rollups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_daily_rollups" ADD CONSTRAINT "transaction_daily_rollups_connection_id_connector_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connector_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_daily_balances_bucket_idx" ON "account_daily_balances" USING btree ("connection_id","account_external_id","day");--> statement-breakpoint
CREATE INDEX "account_daily_balances_user_day_idx" ON "account_daily_balances" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_daily_rollups_bucket_idx" ON "transaction_daily_rollups" USING btree ("connection_id","account_external_id","day","currency","category");--> statement-breakpoint
CREATE INDEX "transaction_daily_rollups_user_day_idx" ON "transaction_daily_rollups" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "financial_transactions_account_occurred_idx" ON "financial_transactions" USING btree ("account_external_id","occurred_at","id");