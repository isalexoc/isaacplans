CREATE TABLE IF NOT EXISTS "blog_comment_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_comment_likes" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"post_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_comment_flags_comment_idx" ON "blog_comment_flags" ("comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_comment_flags_unique_idx" ON "blog_comment_flags" ("comment_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_comment_likes_comment_idx" ON "blog_comment_likes" ("comment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_comment_likes_user_idx" ON "blog_comment_likes" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_comment_likes_unique_idx" ON "blog_comment_likes" ("comment_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_comments_post_idx" ON "blog_comments" ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_comments_parent_idx" ON "blog_comments" ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_comments_user_idx" ON "blog_comments" ("user_id");