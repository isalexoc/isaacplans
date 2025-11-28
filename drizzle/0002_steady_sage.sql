DROP INDEX IF EXISTS "blog_likes_post_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_likes_post_user_unique_idx" ON "blog_likes" ("post_id","user_id");