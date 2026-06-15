CREATE TABLE IF NOT EXISTS "call_summary_processed" (
	"message_id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"location_id" text NOT NULL,
	"note_id" text,
	"direction" text,
	"call_duration_seconds" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"source" text,
	"recording_url" text,
	"job_state" jsonb,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_behind_agent_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"professional_title" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"profile_image_url" text DEFAULT '' NOT NULL,
	"profile_image_public_id" text DEFAULT '' NOT NULL,
	"company_logo_url" text DEFAULT '' NOT NULL,
	"company_logo_public_id" text DEFAULT '' NOT NULL,
	"logo_remove_background" boolean DEFAULT true NOT NULL,
	"onboarding_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_behind_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"quote_type" text NOT NULL,
	"prospect_name" text,
	"quote_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"code_verifier" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_platform_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"platform_user_id" text,
	"platform_account_name" text,
	"platform_metadata" jsonb,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_scheduled_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sanity_post_id" text NOT NULL,
	"sanity_post_title" text,
	"platform" text NOT NULL,
	"locale" text NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"published_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"platform_post_id" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"copy_snapshot" jsonb,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_contact_id_idx" ON "call_summary_processed" ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_status_idx" ON "call_summary_processed" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_processed_at_idx" ON "call_summary_processed" ("processed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_summary_processed_source_status_idx" ON "call_summary_processed" ("source","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_behind_clients_user_id_idx" ON "leave_behind_clients" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_behind_clients_user_updated_idx" ON "leave_behind_clients" ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spc_user_platform_idx" ON "social_platform_connections" ("user_id","platform");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spc_user_id_idx" ON "social_platform_connections" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ssp_pending_idx" ON "social_scheduled_posts" ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ssp_sanity_idx" ON "social_scheduled_posts" ("sanity_post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ssp_user_idx" ON "social_scheduled_posts" ("user_id","status");