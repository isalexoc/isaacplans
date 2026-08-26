CREATE TABLE IF NOT EXISTS "iul_document_captures" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"session_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"upload_count" integer DEFAULT 0 NOT NULL,
	"opened_at" timestamp,
	"last_upload_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "iul_doc_capture_token_unique_idx" ON "iul_document_captures" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iul_doc_capture_session_idx" ON "iul_document_captures" ("session_id","status");