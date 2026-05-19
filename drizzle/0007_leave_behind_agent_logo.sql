ALTER TABLE "leave_behind_agent_profiles" ADD COLUMN IF NOT EXISTS "company_logo_url" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_behind_agent_profiles" ADD COLUMN IF NOT EXISTS "profile_image_public_id" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_behind_agent_profiles" ADD COLUMN IF NOT EXISTS "company_logo_public_id" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_behind_agent_profiles" ADD COLUMN IF NOT EXISTS "logo_remove_background" boolean DEFAULT true NOT NULL;
