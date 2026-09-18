ALTER TABLE "call_study_recordings" ADD COLUMN "shareable_audio_id" text;--> statement-breakpoint
ALTER TABLE "call_study_recordings" ADD COLUMN "shareable_audio_at" timestamp;--> statement-breakpoint
ALTER TABLE "call_study_recordings" ADD COLUMN "shareable_status" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "call_study_recordings" ADD COLUMN "shareable_error" text;--> statement-breakpoint
ALTER TABLE "call_study_recordings" ADD COLUMN "redaction_spans" jsonb;--> statement-breakpoint
ALTER TABLE "call_study_recordings" ADD COLUMN "unmasked_runs" jsonb;--> statement-breakpoint
ALTER TABLE "call_study_recordings" ADD COLUMN "transcript_scrubbed_at" timestamp;