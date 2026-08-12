CREATE TABLE IF NOT EXISTS "intake_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"lob" text NOT NULL,
	"token" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"client_user_id" text,
	"client_device_id" text,
	"expires_at" timestamp,
	"crm_contact_id" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"reopened_for_client" boolean DEFAULT false NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"locale" text DEFAULT 'en',
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "intake_token_unique_idx" ON "intake_sessions" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_owner_idx" ON "intake_sessions" ("lob","owner_user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_device_idx" ON "intake_sessions" ("lob","client_device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_contact_idx" ON "intake_sessions" ("lob","crm_contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_status_idx" ON "intake_sessions" ("lob","status");