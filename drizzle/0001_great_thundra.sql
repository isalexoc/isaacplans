CREATE TABLE IF NOT EXISTS "blog_likes" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"post_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_likes_post_id_idx" ON "blog_likes" ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_likes_user_id_idx" ON "blog_likes" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_likes_post_user_idx" ON "blog_likes" ("post_id","user_id");