import { integer, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const watchHistoryTable = pgTable(
  "watch_history",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    mediaId: integer("media_id").notNull(),
    mediaType: varchar("media_type", { length: 10 }).notNull(),
    title: varchar("title").notNull(),
    posterPath: varchar("poster_path"),
    backdropPath: varchar("backdrop_path"),
    season: integer("season"),
    episode: integer("episode"),
    episodeName: varchar("episode_name"),
    watchedAt: timestamp("watched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_watch_history").on(t.userId, t.mediaId, t.mediaType, t.season, t.episode),
  ],
);

export type WatchHistoryItem = typeof watchHistoryTable.$inferSelect;
export type InsertWatchHistory = typeof watchHistoryTable.$inferInsert;
