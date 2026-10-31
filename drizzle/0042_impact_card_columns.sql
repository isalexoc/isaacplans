ALTER TABLE "impact_enrollments" ADD COLUMN IF NOT EXISTS "card_pdf_url" text;--> statement-breakpoint
ALTER TABLE "impact_enrollments" ADD COLUMN IF NOT EXISTS "card_image_url" text;
