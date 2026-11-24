CREATE TABLE IF NOT EXISTS "lead_guard_events" (
	"id" text PRIMARY KEY NOT NULL,
	"surface" text NOT NULL,
	"verdict" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text,
	"shadow" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_hold_appends" (
	"id" text PRIMARY KEY NOT NULL,
	"hold_id" text NOT NULL,
	"route" text NOT NULL,
	"body_enc" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"surface" text NOT NULL,
	"lead_type" text,
	"route" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"payload_enc" text,
	"preview" jsonb,
	"notified_at" timestamp,
	"released_at" timestamp,
	"released_by" text,
	"released_contact_id" text,
	"release_error" text,
	"release_started_at" timestamp,
	"discarded_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_guard_events_surface_idx" ON "lead_guard_events" ("surface","verdict","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_guard_events_created_idx" ON "lead_guard_events" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_hold_appends_hold_idx" ON "lead_hold_appends" ("hold_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_holds_status_idx" ON "lead_holds" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_holds_expires_idx" ON "lead_holds" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_holds_notified_idx" ON "lead_holds" ("notified_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_hold_appends" ADD CONSTRAINT "lead_hold_appends_hold_id_lead_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "lead_holds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
