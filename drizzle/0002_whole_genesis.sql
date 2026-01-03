CREATE TYPE "public"."activity_type" AS ENUM('play', 'download', 'view', 'upload', 'comment', 'vote');--> statement-breakpoint
CREATE TYPE "public"."vote_type" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TABLE "activity_feed" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_type" "activity_type" NOT NULL,
	"media_file_id" integer,
	"media_title" varchar(255),
	"ip_hash" varchar(64),
	"location" varchar(100),
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "download_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_file_id" integer NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"downloadedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_file_id" integer NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"session_id" varchar(64),
	"play_duration" integer,
	"completedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "view_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_file_id" integer NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"viewedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_file_id" integer NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"session_id" varchar(64),
	"vote_type" "vote_type" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activity_feed_created_at_idx" ON "activity_feed" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "activity_feed_activity_type_idx" ON "activity_feed" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "download_logs_media_file_id_idx" ON "download_logs" USING btree ("media_file_id");--> statement-breakpoint
CREATE INDEX "download_logs_downloaded_at_idx" ON "download_logs" USING btree ("downloadedAt");--> statement-breakpoint
CREATE INDEX "play_logs_media_file_id_idx" ON "play_logs" USING btree ("media_file_id");--> statement-breakpoint
CREATE INDEX "play_logs_completed_at_idx" ON "play_logs" USING btree ("completedAt");--> statement-breakpoint
CREATE INDEX "view_logs_media_file_id_idx" ON "view_logs" USING btree ("media_file_id");--> statement-breakpoint
CREATE INDEX "view_logs_viewed_at_idx" ON "view_logs" USING btree ("viewedAt");--> statement-breakpoint
CREATE INDEX "votes_media_file_id_idx" ON "votes" USING btree ("media_file_id");--> statement-breakpoint
CREATE INDEX "votes_ip_hash_idx" ON "votes" USING btree ("ip_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_unique_vote" ON "votes" USING btree ("media_file_id","ip_hash");