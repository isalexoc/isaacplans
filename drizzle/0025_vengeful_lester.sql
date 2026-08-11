CREATE TABLE IF NOT EXISTS "referral_partner_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"lead_id" text,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"member_count" integer DEFAULT 1 NOT NULL,
	"monthly_premium_cents" integer DEFAULT 0 NOT NULL,
	"commission_bps" integer DEFAULT 500 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"effective_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_partner_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"email" text,
	"phone" text,
	"locale" text DEFAULT 'es' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"crm_contact_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_partners" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_title" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"website" text,
	"logo_url" text,
	"accent_color" text DEFAULT '#0077B6' NOT NULL,
	"commission_bps" integer DEFAULT 500 NOT NULL,
	"default_locale" text DEFAULT 'es' NOT NULL,
	"headline_en" text,
	"headline_es" text,
	"intro_en" text,
	"intro_es" text,
	"audience_en" text,
	"audience_es" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_partner_clients_partner_idx" ON "referral_partner_clients" ("partner_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_partner_clients_status_idx" ON "referral_partner_clients" ("partner_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_partner_leads_partner_idx" ON "referral_partner_leads" ("partner_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_partner_leads_status_idx" ON "referral_partner_leads" ("partner_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "referral_partners_slug_idx" ON "referral_partners" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_partners_email_idx" ON "referral_partners" ("email");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referral_partner_clients" ADD CONSTRAINT "referral_partner_clients_partner_id_referral_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "referral_partners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referral_partner_clients" ADD CONSTRAINT "referral_partner_clients_lead_id_referral_partner_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "referral_partner_leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referral_partner_leads" ADD CONSTRAINT "referral_partner_leads_partner_id_referral_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "referral_partners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
