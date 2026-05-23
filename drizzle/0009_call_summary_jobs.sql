ALTER TABLE "call_summary_processed" ADD COLUMN IF NOT EXISTS "source" text;
--> statement-breakpoint
ALTER TABLE "call_summary_processed" ADD COLUMN IF NOT EXISTS "recording_url" text;
--> statement-breakpoint
ALTER TABLE "call_summary_processed" ADD COLUMN IF NOT EXISTS "job_state" jsonb;
--> statement-breakpoint
ALTER TABLE "call_summary_processed" ADD COLUMN IF NOT EXISTS "attempt_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "call_summary_processed" ADD COLUMN IF NOT EXISTS "next_retry_at" timestamp;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_source_status_idx" ON "call_summary_processed" ("source", "status");
