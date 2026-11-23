CREATE TABLE IF NOT EXISTS "agent_agreements" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"doc" text NOT NULL,
	"version" text NOT NULL,
	"sha256" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"email" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"first_name" text,
	"last_name" text,
	"photo_url" text,
	"whatsapp_e164" text,
	"contact_email" text,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"licensed" boolean DEFAULT false NOT NULL,
	"licensed_states" text[] DEFAULT '{}'::text[] NOT NULL,
	"ibo_number" text,
	"impact_referral_url" text,
	"default_locale" text DEFAULT 'en' NOT NULL,
	"alert_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensitive_access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"actor_user_id" text,
	"actor_role" text NOT NULL,
	"impersonator_user_id" text,
	"owner_user_id" text NOT NULL,
	"session_id" text,
	"action" text NOT NULL,
	"fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"ip_hash" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_agreements_agent_doc_version_unique_idx" ON "agent_agreements" ("agent_id","doc","version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agents_clerk_user_id_unique_idx" ON "agents" ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agents_email_unique_idx" ON "agents" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agents_slug_unique_idx" ON "agents" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_access_log_owner_at_idx" ON "sensitive_access_log" ("owner_user_id","at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_agreements" ADD CONSTRAINT "agent_agreements_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
