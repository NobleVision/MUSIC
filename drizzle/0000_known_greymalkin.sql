CREATE TYPE "public"."media_type" AS ENUM('audio', 'video');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "admin_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_credentials_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_file_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"parent_comment_id" integer,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_file_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_file_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"added_by_id" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_key" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"media_type" "media_type" NOT NULL,
	"lyrics" text,
	"music_style" varchar(255),
	"cover_art_key" text,
	"cover_art_url" text,
	"artist_name" varchar(255),
	"artist_bio" text,
	"isrc" varchar(20),
	"upc" varchar(20),
	"writer_credits" text,
	"is_ai_assisted" boolean DEFAULT false,
	"genres" text,
	"moods" text,
	"share_token" varchar(64),
	"is_publicly_shared" boolean DEFAULT false,
	"allow_download" boolean DEFAULT true,
	"allow_streaming" boolean DEFAULT true,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_files_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_file_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_by_id" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "categories_section_id_idx" ON "categories" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "comments_media_file_id_idx" ON "comments" USING btree ("media_file_id");--> statement-breakpoint
CREATE INDEX "comments_user_id_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_parent_comment_id_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "media_file_tags_media_file_id_idx" ON "media_file_tags" USING btree ("media_file_id");--> statement-breakpoint
CREATE INDEX "media_file_tags_tag_id_idx" ON "media_file_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_file_tags_unique_media_tag" ON "media_file_tags" USING btree ("media_file_id","tag_id");--> statement-breakpoint
CREATE INDEX "media_files_category_id_idx" ON "media_files" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "media_files_user_id_idx" ON "media_files" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_files_share_token_idx" ON "media_files" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "ratings_media_file_id_idx" ON "ratings" USING btree ("media_file_id");--> statement-breakpoint
CREATE INDEX "ratings_user_id_idx" ON "ratings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_unique_user_media" ON "ratings" USING btree ("user_id","media_file_id");--> statement-breakpoint
CREATE INDEX "sections_user_id_idx" ON "sections" USING btree ("user_id");