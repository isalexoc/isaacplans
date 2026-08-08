ALTER TABLE "fe_intake_sessions" ADD COLUMN "client_device_id" text;--> statement-breakpoint
ALTER TABLE "fe_intake_sessions" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fe_intake_device_idx" ON "fe_intake_sessions" ("client_device_id");