CREATE TABLE IF NOT EXISTS "mailing_labels" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_ref" text,
	"created_by_user_id" text,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"phone" text,
	"email" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"printed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mailing_labels_status_idx" ON "mailing_labels" ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mailing_labels_source_ref_idx" ON "mailing_labels" ("source","source_ref");