ALTER TABLE "media_files" ADD COLUMN "play_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "download_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "upvotes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "downvotes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "hotness_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_files" ADD COLUMN "last_hotness_update" timestamp;