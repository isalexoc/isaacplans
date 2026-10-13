CREATE TABLE IF NOT EXISTS "illustration_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"created_by_user_id" text NOT NULL,
	"carrier_key" text NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"product_name" text DEFAULT '' NOT NULL,
	"source_file_name" text DEFAULT '' NOT NULL,
	"extraction" jsonb NOT NULL,
	"presentation" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "illustration_summaries_user_updated_idx" ON "illustration_summaries" ("created_by_user_id","updated_at");