CREATE TABLE IF NOT EXISTS "crankwheel_meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"session_id" text,
	"crm_contact_id" text,
	"owner_user_id" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"locale" text DEFAULT 'en',
	"url" text NOT NULL,
	"uid" text,
	"hook_secret" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"session_started_at" timestamp,
	"viewer_joined_at" timestamp,
	"sent_at" timestamp,
	"cw_session_id" integer,
	"duration_seconds" integer,
	"note_posted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crankwheel_hook_secret_unique_idx" ON "crankwheel_meetings" ("hook_secret");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crankwheel_cw_session_unique_idx" ON "crankwheel_meetings" ("cw_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crankwheel_session_idx" ON "crankwheel_meetings" ("session_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crankwheel_contact_idx" ON "crankwheel_meetings" ("crm_contact_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crankwheel_owner_idx" ON "crankwheel_meetings" ("owner_user_id","created_at");