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
CREATE INDEX IF NOT EXISTS "leave_behind_clients_user_id_idx" ON "leave_behind_clients" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_behind_clients_user_updated_idx" ON "leave_behind_clients" USING btree ("user_id","updated_at");
