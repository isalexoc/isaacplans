CREATE TABLE IF NOT EXISTS "iul_intake_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"client_user_id" text,
	"crm_contact_id" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"locale" text DEFAULT 'en',
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "iul_intake_token_unique_idx" ON "iul_intake_sessions" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iul_intake_owner_idx" ON "iul_intake_sessions" ("owner_user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iul_intake_client_idx" ON "iul_intake_sessions" ("client_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iul_intake_contact_idx" ON "iul_intake_sessions" ("crm_contact_id");