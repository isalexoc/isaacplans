CREATE TABLE IF NOT EXISTS "telegram_leads" (
	"lead_key" text PRIMARY KEY NOT NULL,
	"chat_id" text,
	"message_id" text,
	"update_id" text,
	"contact_id" text,
	"location_id" text,
	"phone" text,
	"email" text,
	"first_name" text,
	"last_name" text,
	"state_code" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_reason" text,
	"error_message" text,
	"parse_source" text,
	"matched_by" text,
	"tags_added" jsonb,
	"cadence_started" boolean DEFAULT false NOT NULL,
	"job_state" jsonb,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"message_at" timestamp,
	"reviewed_at" timestamp,
	"reviewed_by_user_id" text,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_leads_status_idx" ON "telegram_leads" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_leads_needs_review_idx" ON "telegram_leads" ("needs_review","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_leads_phone_idx" ON "telegram_leads" ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_leads_created_at_idx" ON "telegram_leads" ("created_at");