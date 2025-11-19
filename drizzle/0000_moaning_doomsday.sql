CREATE TABLE IF NOT EXISTS "guide_analytics" (
	"id" text PRIMARY KEY NOT NULL,
	"guide_id" text NOT NULL,
	"event_type" text NOT NULL,
	"email" text,
	"phone" text,
	"user_agent" text,
	"ip_address" text,
	"referrer" text,
	"source" text,
	"campaign" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_unlocks" (
	"id" text PRIMARY KEY NOT NULL,
	"guide_id" text NOT NULL,
	"email" text,
	"phone" text,
	"unlocked_at" timestamp DEFAULT now(),
	"source" text,
	"campaign" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guides" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"title_es" text,
	"description" text NOT NULL,
	"description_es" text,
	"thumbnail" text NOT NULL,
	"pdf_url" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_guide_id_idx" ON "guide_analytics" ("guide_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_event_type_idx" ON "guide_analytics" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_created_at_idx" ON "guide_analytics" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_id_idx" ON "guide_unlocks" ("guide_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_idx" ON "guide_unlocks" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_idx" ON "guide_unlocks" ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_email_idx" ON "guide_unlocks" ("guide_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_phone_idx" ON "guide_unlocks" ("guide_id","phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_idx" ON "guides" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "active_idx" ON "guides" ("active");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guide_analytics" ADD CONSTRAINT "guide_analytics_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guide_unlocks" ADD CONSTRAINT "guide_unlocks_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
