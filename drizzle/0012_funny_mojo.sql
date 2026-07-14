CREATE TABLE IF NOT EXISTS "sale_stickers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_name" text NOT NULL,
	"lead_source" text NOT NULL,
	"lead_source_custom" text,
	"sale_type" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"sale_date" date NOT NULL,
	"daily_sequence" integer NOT NULL,
	"custom_phrase" text,
	"extra_image_url" text,
	"extra_image_public_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_stickers_user_id_idx" ON "sale_stickers" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_stickers_user_date_idx" ON "sale_stickers" ("user_id","sale_date");