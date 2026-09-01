import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "next-auth/adapters";

// NextAuth tables
export const users = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  password: text("password"),
  theme: text("theme").default("global").notNull(),
  role: text("role").default("user").notNull(),
  status: text("status").default("active").notNull(),
  lastActiveAt: integer("lastActiveAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// Watch history table
export const watchHistory = sqliteTable(
  "watch_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaId: integer("media_id").notNull(),
    mediaType: text("media_type").notNull(),
    title: text("title").notNull(),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    season: integer("season").notNull().default(0),
    episode: integer("episode").notNull().default(0),
    episodeName: text("episode_name"),
    progress: integer("progress").default(0),
    duration: integer("duration").default(0),
    watchedAt: integer("watched_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_watch_history").on(
      t.userId,
      t.mediaId,
      t.mediaType,
      t.season,
      t.episode
    ),
  ]
);

// Watchlist table
export const watchlists = sqliteTable(
  "watchlist",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaId: integer("media_id").notNull(),
    mediaType: text("media_type").notNull(),
    title: text("title").notNull(),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_watchlist_user_media").on(t.userId, t.mediaId, t.mediaType),
  ]
);

// Manga Reading History table
export const mangaReadingHistory = sqliteTable(
  "manga_reading_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mangaId: text("manga_id").notNull(),
    mangaTitle: text("manga_title").notNull(),
    mangaCover: text("manga_cover").notNull(),
    mangaType: text("manga_type").notNull().default("manga"),
    chapterId: text("chapter_id").notNull(),
    chapterNumber: text("chapter_number").notNull(),
    chapterTitle: text("chapter_title"),
    pageNumber: integer("page_number").notNull().default(1),
    totalPages: integer("total_pages").notNull().default(1),
    nextChapterId: text("next_chapter_id"),
    nextChapterNumber: text("next_chapter_number"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_manga_reading_user_manga").on(t.userId, t.mangaId),
  ]
);

export type MangaReadingHistoryItem = typeof mangaReadingHistory.$inferSelect;
export type NewMangaReadingHistoryItem = typeof mangaReadingHistory.$inferInsert;

// Manga Bookmarks / Watchlist table
export const mangaBookmarks = sqliteTable(
  "manga_bookmarks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mangaId: text("manga_id").notNull(),
    mediaType: text("media_type").notNull().default("manga"),
    title: text("title").notNull(),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_manga_bookmarks_user_manga").on(t.userId, t.mangaId),
  ]
);

export type MangaBookmarkItem = typeof mangaBookmarks.$inferSelect;
export type NewMangaBookmarkItem = typeof mangaBookmarks.$inferInsert;

// Site Announcements table
export const siteAnnouncements = sqliteTable("site_announcements", {
  id: text("id").primaryKey().default("current"),
  message: text("message"),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
});

// Custom Curated Homepage Sections
export const customHomeSections = sqliteTable("custom_home_sections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  icon: text("icon"),
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
  items: text("items", { mode: "json" }).notNull().$type<any[]>().default([]),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
});

// Custom Curated Franchises / Collections
export const customFranchises = sqliteTable("custom_franchises", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  overview: text("overview"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  parts: text("parts", { mode: "json" }).notNull().$type<any[]>().default([]),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
});

// Spotlight Featured Hero Banner
export const siteSpotlight = sqliteTable("site_spotlight", {
  id: text("id").primaryKey().default("current"),
  enabled: integer("enabled", { mode: "boolean" }).default(false).notNull(),
  title: text("title"),
  tagline: text("tagline"),
  description: text("description"),
  backdropPath: text("backdrop_path"),
  posterPath: text("poster_path"),
  targetUrl: text("target_url"),
  mediaType: text("media_type").default("movie"),
  badge: text("badge"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
});

// Site Appearance Settings
export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey().default("current"),
  accentColor: text("accent_color").default("#7288AE").notNull(),
  heroStyle: text("hero_style").default("cinematic").notNull(),
  tagline: text("tagline").default("Movies. TV. Anime. All in one place.").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
});

// Custom Dynamic Themes Created by Admins
export const customThemes = sqliteTable("custom_themes", {
  id: text("id").primaryKey().$defaultFn(() => `custom_${crypto.randomUUID().slice(0, 8)}`),
  label: text("label").notNull(),
  tagline: text("tagline").default("Custom").notNull(),
  description: text("description"),
  background: text("background").default("#080C14").notNull(),
  card: text("card").default("#141C2B").notNull(),
  primary: text("primary").default("#38BDF8").notNull(),
  accent: text("accent").default("#F43F5E").notNull(),
  foreground: text("foreground").default("#E2E8F0").notNull(),
  preview: text("preview"),
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
});

// Admin-controlled streaming source order + tags
export const streamingSourceConfig = sqliteTable(
  "streaming_source_config",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    category: text("category").notNull(),
    sourceKey: text("source_key").notNull(),
    position: integer("position").default(0).notNull(),
    tag: text("tag").default("good").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex("uq_streaming_source_category_key").on(t.category, t.sourceKey)]
);

// Issue Reports table
export const issueReports = sqliteTable("issue_reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  userEmail: text("user_email"),
  status: text("status").default("open").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
});

// Admin Entry Overrides (Upcoming, Unavailable, Hidden, Custom Metadata)
export const mediaOverrides = sqliteTable(
  "media_overrides",
  {
    id: text("id").primaryKey(),
    mediaType: text("media_type").notNull(),
    mediaId: text("media_id").notNull(),
    status: text("status").default("default").notNull(),
    isHidden: integer("is_hidden", { mode: "boolean" }).default(false).notNull(),
    isUpcoming: integer("is_upcoming", { mode: "boolean" }).default(false).notNull(),
    isUnavailable: integer("is_unavailable", { mode: "boolean" }).default(false).notNull(),
    customTitle: text("custom_title"),
    customDescription: text("custom_description"),
    customGenres: text("custom_genres", { mode: "json" }).$type<string[]>().default([]),
    customReleaseDate: text("custom_release_date"),
    customPoster: text("custom_poster"),
    customBackdrop: text("custom_backdrop"),
    customTags: text("custom_tags", { mode: "json" }).$type<string[]>().default([]),
    notes: text("notes"),
    updatedBy: text("updated_by"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex("uq_media_overrides_type_id").on(t.mediaType, t.mediaId)]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type WatchHistoryItem = typeof watchHistory.$inferSelect;
export type InsertWatchHistory = typeof watchHistory.$inferInsert;
export type WatchlistItem = typeof watchlists.$inferSelect;
export type InsertWatchlistItem = typeof watchlists.$inferInsert;
export type SiteAnnouncement = typeof siteAnnouncements.$inferSelect;
export type InsertSiteAnnouncement = typeof siteAnnouncements.$inferInsert;
export type CustomHomeSection = typeof customHomeSections.$inferSelect;
export type InsertCustomHomeSection = typeof customHomeSections.$inferInsert;
export type CustomFranchise = typeof customFranchises.$inferSelect;
export type InsertCustomFranchise = typeof customFranchises.$inferInsert;
export type SiteSpotlight = typeof siteSpotlight.$inferSelect;
export type InsertSiteSpotlight = typeof siteSpotlight.$inferInsert;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;
export type CustomTheme = typeof customThemes.$inferSelect;
export type InsertCustomTheme = typeof customThemes.$inferInsert;
export type IssueReport = typeof issueReports.$inferSelect;
export type InsertIssueReport = typeof issueReports.$inferInsert;
export type StreamingSourceConfig = typeof streamingSourceConfig.$inferSelect;
export type InsertStreamingSourceConfig = typeof streamingSourceConfig.$inferInsert;
export type MediaOverride = typeof mediaOverrides.$inferSelect;
export type InsertMediaOverride = typeof mediaOverrides.$inferInsert;
