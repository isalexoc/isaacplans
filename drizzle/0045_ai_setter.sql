CREATE TABLE IF NOT EXISTS "ai_setter_daily_usage" (
	"day" text PRIMARY KEY NOT NULL,
	"turns" integer DEFAULT 0 NOT NULL,
	"reserved_micros" integer DEFAULT 0 NOT NULL,
	"cost_micros" integer DEFAULT 0 NOT NULL,
	"sends" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_setter_events" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"type" text NOT NULL,
	"detail" jsonb,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_setter_leads" (
	"contact_id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"language" text,
	"register" text,
	"product" text,
	"lead_timezone" text,
	"state_code" text,
	"run_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"turn_state" text DEFAULT 'idle' NOT NULL,
	"poke_pending" boolean DEFAULT false NOT NULL,
	"armed_at" timestamp,
	"last_handled_inbound_id" text,
	"last_handled_inbound_at" timestamp,
	"last_inbound_at" timestamp,
	"last_ai_outbound_at" timestamp,
	"disclosed_channels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"paused_until" timestamp,
	"pause_reason" text,
	"offered_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"offered_at" timestamp,
	"rejections_count" integer DEFAULT 0 NOT NULL,
	"appointment_id" text,
	"appointment_at" timestamp,
	"calendar_id" text,
	"booking_intent" jsonb,
	"call_now_state" text,
	"call_now_requested_at" timestamp,
	"turns_day" text,
	"turns_today" integer DEFAULT 0 NOT NULL,
	"thread_turns" integer DEFAULT 0 NOT NULL,
	"opt_out_pending" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_setter_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"template_id" text,
	"template_hash" text,
	"body" text,
	"original_body" text,
	"status" text NOT NULL,
	"intent" text,
	"in_reply_to_inbound_id" text,
	"turn_run_id" text,
	"ghl_message_id" text,
	"decision" jsonb,
	"guard_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" integer DEFAULT 0 NOT NULL,
	"used_fallback" boolean DEFAULT false NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"sent_at" timestamp,
	"not_before" timestamp,
	"expires_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_setter_suppressions" (
	"e164" text PRIMARY KEY NOT NULL,
	"scope" text DEFAULT 'all' NOT NULL,
	"source" text NOT NULL,
	"raw_text" text,
	"contact_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"lifted_at" timestamp,
	"lift_reason" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_setter_events_contact_idx" ON "ai_setter_events" ("contact_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_setter_events_type_idx" ON "ai_setter_events" ("type","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_setter_leads_status_idx" ON "ai_setter_leads" ("status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_setter_leads_turn_state_idx" ON "ai_setter_leads" ("turn_state","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_setter_messages_contact_idx" ON "ai_setter_messages" ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_setter_messages_status_idx" ON "ai_setter_messages" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_setter_messages_ghl_message_idx" ON "ai_setter_messages" ("ghl_message_id");