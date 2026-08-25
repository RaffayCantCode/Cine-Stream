CREATE TABLE IF NOT EXISTS "manga_bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"manga_id" varchar(255) NOT NULL,
	"media_type" varchar(32) DEFAULT 'manga' NOT NULL,
	"title" varchar(500) NOT NULL,
	"poster_path" varchar(1000),
	"backdrop_path" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_manga_bookmarks_user_manga" UNIQUE("user_id","manga_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "manga_reading_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"manga_id" varchar(255) NOT NULL,
	"manga_title" varchar(500) NOT NULL,
	"manga_cover" varchar(1000) NOT NULL,
	"manga_type" varchar(32) DEFAULT 'manga' NOT NULL,
	"chapter_id" varchar(255) NOT NULL,
	"chapter_number" varchar(64) NOT NULL,
	"chapter_title" varchar(500),
	"page_number" integer DEFAULT 1 NOT NULL,
	"total_pages" integer DEFAULT 1 NOT NULL,
	"next_chapter_id" varchar(255),
	"next_chapter_number" varchar(64),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_manga_reading_user_manga" UNIQUE("user_id","manga_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_overrides" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"media_type" varchar(32) NOT NULL,
	"media_id" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'default' NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_upcoming" boolean DEFAULT false NOT NULL,
	"is_unavailable" boolean DEFAULT false NOT NULL,
	"custom_title" varchar(500),
	"custom_description" text,
	"custom_genres" jsonb DEFAULT '[]'::jsonb,
	"custom_release_date" varchar(64),
	"custom_poster" varchar(1000),
	"custom_backdrop" varchar(1000),
	"custom_tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_media_overrides_type_id" UNIQUE("media_type","media_id")
);