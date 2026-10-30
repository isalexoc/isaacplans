CREATE TABLE IF NOT EXISTS "impact_enrollments" (
	"crm_contact_id" text PRIMARY KEY NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"member_id" text NOT NULL,
	"start_date" date NOT NULL,
	"monthly_amount_cents" integer NOT NULL,
	"payment_day" integer NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"card_pdf_url" text,
	"card_image_url" text,
	"send_count" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp,
	"last_sent_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
