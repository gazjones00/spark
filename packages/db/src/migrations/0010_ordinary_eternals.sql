CREATE TABLE "category_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"matchers" jsonb NOT NULL,
	"category" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"normalized_name" text NOT NULL,
	"display_name" text NOT NULL,
	"match_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_category_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_enrichments" (
	"transaction_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"source" text NOT NULL,
	"merchant_id" text,
	"derived_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_category_overrides" ADD CONSTRAINT "transaction_category_overrides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_category_overrides" ADD CONSTRAINT "transaction_category_overrides_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_enrichments" ADD CONSTRAINT "transaction_enrichments_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_enrichments" ADD CONSTRAINT "transaction_enrichments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_enrichments" ADD CONSTRAINT "transaction_enrichments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_rules_user_id_idx" ON "category_rules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_normalized_name_idx" ON "merchants" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_category_overrides_transaction_idx" ON "transaction_category_overrides" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_category_overrides_user_id_idx" ON "transaction_category_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_enrichments_user_id_idx" ON "transaction_enrichments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_enrichments_user_category_idx" ON "transaction_enrichments" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "transaction_enrichments_merchant_id_idx" ON "transaction_enrichments" USING btree ("merchant_id");