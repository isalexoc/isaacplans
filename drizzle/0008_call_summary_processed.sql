CREATE TABLE IF NOT EXISTS "call_summary_processed" (
	"message_id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"location_id" text NOT NULL,
	"note_id" text,
	"direction" text,
	"call_duration_seconds" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_contact_id_idx" ON "call_summary_processed" ("contact_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_status_idx" ON "call_summary_processed" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_processed_at_idx" ON "call_summary_processed" ("processed_at");
