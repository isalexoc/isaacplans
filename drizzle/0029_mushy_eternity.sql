ALTER TABLE "referral_partners" ADD COLUMN "og_image_url_en" text;--> statement-breakpoint
ALTER TABLE "referral_partners" ADD COLUMN "og_image_url_es" text;--> statement-breakpoint
-- Carry the old single share image into both languages so nothing set before the split is lost.
UPDATE "referral_partners" SET "og_image_url_en" = "og_image_url", "og_image_url_es" = "og_image_url" WHERE "og_image_url" IS NOT NULL;
