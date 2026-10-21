CREATE INDEX IF NOT EXISTS "idx_watch_history_user_watched" ON "watch_history" ("user_id", "watched_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_manga_history_user_updated" ON "manga_reading_history" ("user_id", "updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_manga_history_updated" ON "manga_reading_history" ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_watchlist_user_created" ON "watchlist" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_manga_bookmarks_user_created" ON "manga_bookmarks" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_last_active" ON "user" ("lastActiveAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_created" ON "user" ("createdAt");--> statement-breakpoint
-- lastActiveAt was not maintained before this release. Give every existing
-- account a fresh 30-day grace period so active users cannot lose old manga
-- history just because the activity heartbeat did not exist yet.
UPDATE "user" SET "lastActiveAt" = CAST(strftime('%s', 'now') AS INTEGER) * 1000;
