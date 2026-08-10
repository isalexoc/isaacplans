ALTER TABLE "aca_intake_sessions" ADD COLUMN "client_device_id" text;--> statement-breakpoint
ALTER TABLE "aca_intake_sessions" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "iul_intake_sessions" ADD COLUMN "client_device_id" text;--> statement-breakpoint
ALTER TABLE "iul_intake_sessions" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aca_intake_device_idx" ON "aca_intake_sessions" ("client_device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iul_intake_device_idx" ON "iul_intake_sessions" ("client_device_id");