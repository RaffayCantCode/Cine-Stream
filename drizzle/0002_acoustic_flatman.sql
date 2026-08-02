CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"media_id" integer NOT NULL,
	"media_type" varchar(10) NOT NULL,
	"title" varchar NOT NULL,
	"poster_path" varchar,
	"backdrop_path" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_watchlist_user_media" UNIQUE("user_id","media_id","media_type")
);
--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;