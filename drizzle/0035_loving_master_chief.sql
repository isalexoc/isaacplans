CREATE TABLE IF NOT EXISTS "call_study_recordings" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"title" text NOT NULL,
	"source_filename" text,
	"cloudinary_public_id" text,
	"audio_url" text,
	"duration_seconds" integer,
	"size_bytes" integer,
	"language_code" text,
	"eleven_request_id" text,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"error_message" text,
	"speaker_map" jsonb,
	"turns" jsonb,
	"metrics" jsonb,
	"analysis" jsonb,
	"outcome" text DEFAULT 'unknown' NOT NULL,
	"line_of_business" text,
	"transcribed_at" timestamp,
	"analyzed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_study_snippets" (
	"id" text PRIMARY KEY NOT NULL,
	"recording_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"category" text NOT NULL,
	"objection_type" text,
	"speaker_name" text,
	"speaker_role" text,
	"quote" text NOT NULL,
	"why" text,
	"start_sec" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "call_study_request_unique_idx" ON "call_study_recordings" ("eleven_request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_study_owner_idx" ON "call_study_recordings" ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_study_status_idx" ON "call_study_recordings" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_snippet_recording_idx" ON "call_study_snippets" ("recording_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_snippet_owner_idx" ON "call_study_snippets" ("owner_user_id","category");