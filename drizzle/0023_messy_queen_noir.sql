ALTER TABLE "mailing_labels" ADD COLUMN "crm_contact_id" text;--> statement-breakpoint
ALTER TABLE "mailing_labels" ADD COLUMN "letter_body" text;--> statement-breakpoint
ALTER TABLE "mailing_labels" ADD COLUMN "letter_generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "mailing_labels" ADD COLUMN "letter_edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "mailing_labels" ADD COLUMN "letter_context" text;