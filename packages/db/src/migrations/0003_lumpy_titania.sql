CREATE TABLE "truelayer_oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code_verifier" text NOT NULL,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_key_id" text,
	"token_expires_at" timestamp with time zone,
	"accounts" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "truelayer_connections" RENAME COLUMN "access_token" TO "encrypted_access_token";--> statement-breakpoint
ALTER TABLE "truelayer_connections" RENAME COLUMN "refresh_token" TO "encrypted_refresh_token";--> statement-breakpoint
ALTER TABLE "truelayer_connections" ADD COLUMN "token_key_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "truelayer_oauth_states" ADD CONSTRAINT "truelayer_oauth_states_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;