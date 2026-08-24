CREATE TABLE IF NOT EXISTS "iul_secure_captures" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"session_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"field_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opened_at" timestamp,
	"submitted_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iul_intake_sessions" ADD COLUMN "sensitive_captured_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "iul_capture_token_unique_idx" ON "iul_secure_captures" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iul_capture_session_idx" ON "iul_secure_captures" ("session_id","status");