CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmation_token" text,
	"unsubscribe_token" text,
	"source" text,
	"locale" text DEFAULT 'en',
	"confirmed_at" timestamp,
	"unsubscribed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "newsletter_email_idx" ON "newsletter_subscribers" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "newsletter_status_idx" ON "newsletter_subscribers" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "newsletter_confirmation_token_idx" ON "newsletter_subscribers" ("confirmation_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "newsletter_unsubscribe_token_idx" ON "newsletter_subscribers" ("unsubscribe_token");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_email_unique_idx" ON "newsletter_subscribers" ("email");