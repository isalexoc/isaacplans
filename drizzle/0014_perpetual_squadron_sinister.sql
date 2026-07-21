CREATE TABLE IF NOT EXISTS "missed_call_drafts" (
	"draft_key" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"location_id" text NOT NULL,
	"note_id" text,
	"reason" text,
	"source" text,
	"line_of_business" text,
	"language" text,
	"sms_draft" text,
	"whatsapp_draft" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_summary_processed" ADD COLUMN "disposition" text;--> statement-breakpoint
ALTER TABLE "call_summary_processed" ADD COLUMN "line_of_business" text;--> statement-breakpoint
ALTER TABLE "call_summary_processed" ADD COLUMN "follow_up_date_iso" timestamp;--> statement-breakpoint
ALTER TABLE "call_summary_processed" ADD COLUMN "structured_summary" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "missed_call_drafts_contact_id_idx" ON "missed_call_drafts" ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "missed_call_drafts_status_idx" ON "missed_call_drafts" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "missed_call_drafts_created_at_idx" ON "missed_call_drafts" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_disposition_idx" ON "call_summary_processed" ("disposition");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_line_of_business_idx" ON "call_summary_processed" ("line_of_business");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_status_processed_at_idx" ON "call_summary_processed" ("status","processed_at");