CREATE TABLE IF NOT EXISTS "phone_finder_daily_usage" (
	"day" text PRIMARY KEY NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"cost_mills" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "phone_finder_runs" (
	"contact_id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"outcome" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"result_text" text,
	"result_tags" jsonb,
	"summary" jsonb,
	"cost_mills" integer DEFAULT 0 NOT NULL,
	"daily_slot_day" text,
	"error_message" text,
	"last_input_hash" text,
	"last_searched_at" timestamp,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_finder_runs_status_idx" ON "phone_finder_runs" ("status","updated_at");