CREATE TABLE IF NOT EXISTS "leads_the_way_processed" (
	"lead_key" text PRIMARY KEY NOT NULL,
	"contact_id" text,
	"location_id" text,
	"phone" text,
	"email" text,
	"lead_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"job_state" jsonb,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_the_way_processed_status_idx" ON "leads_the_way_processed" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_the_way_processed_phone_idx" ON "leads_the_way_processed" ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_the_way_processed_lead_id_idx" ON "leads_the_way_processed" ("lead_id");