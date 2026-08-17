CREATE TABLE "streaming_source_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(16) NOT NULL,
	"source_key" varchar(64) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"tag" varchar(32) DEFAULT 'unknown' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_streaming_source_category_key" UNIQUE("category","source_key")
);
