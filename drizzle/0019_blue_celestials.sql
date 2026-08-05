CREATE TABLE IF NOT EXISTS "video_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"video_clip_url" text,
	"clip_duration_sec" integer,
	"concept" text NOT NULL,
	"category" text NOT NULL,
	"locale" text,
	"embedding" jsonb NOT NULL,
	"source_post_id" text,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_assets_category_locale_idx" ON "video_assets" ("category","locale");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "video_assets_image_url_unique_idx" ON "video_assets" ("image_url");