CREATE TABLE IF NOT EXISTS "social_video_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sanity_post_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"category" text,
	"voice_language" text,
	"scene_index" integer,
	"input" jsonb,
	"job_state" jsonb,
	"result_url" text,
	"result_data" jsonb,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"qstash_message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "svj_post_idx" ON "social_video_jobs" ("sanity_post_id","kind","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "svj_status_idx" ON "social_video_jobs" ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "svj_user_idx" ON "social_video_jobs" ("user_id","status");