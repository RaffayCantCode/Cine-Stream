import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

// NextAuth tables
export const users = pgTable("user", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).unique(),
  emailVerified: timestamp("emailVerified", {
    mode: "date",
    withTimezone: true,
  }),
  image: varchar("image", { length: 255 }),
  password: varchar("password", { length: 255 }),
  theme: varchar("theme", { length: 32 }).default("global").notNull(),
  role: varchar("role", { length: 32 }).default("user").notNull(),
  status: varchar("status", { length: 32 }).default("active").notNull(),
  lastActiveAt: timestamp("lastActiveAt", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: varchar("sessionToken", { length: 255 }).primaryKey(),
  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// Watch history table
export const watchHistory = pgTable(
  "watch_history",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaId: integer("media_id").notNull(),
    mediaType: varchar("media_type", { length: 10 }).notNull(),
    title: varchar("title").notNull(),
    posterPath: varchar("poster_path"),
    backdropPath: varchar("backdrop_path"),
    season: integer("season").notNull().default(0),
    episode: integer("episode").notNull().default(0),
    episodeName: varchar("episode_name"),
    progress: integer("progress").default(0),
    duration: integer("duration").default(0),
    watchedAt: timestamp("watched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("uq_watch_history").on(
      t.userId,
      t.mediaId,
      t.mediaType,
      t.season,
      t.episode
    ),
  ]
);

// Watchlist table
export const watchlists = pgTable(
  "watchlist",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaId: integer("media_id").notNull(),
    mediaType: varchar("media_type", { length: 10 }).notNull(),
    title: varchar("title").notNull(),
    posterPath: varchar("poster_path"),
    backdropPath: varchar("backdrop_path"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("uq_watchlist_user_media").on(t.userId, t.mediaId, t.mediaType),
  ]
);

// Site Announcements table
export const siteAnnouncements = pgTable("site_announcements", {
  id: varchar("id", { length: 32 }).primaryKey().default("current"),
  message: text("message"),
  updatedBy: varchar("updated_by", { length: 255 }).references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Custom Curated Homepage Sections
export const customHomeSections = pgTable("custom_home_sections", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 255 }),
  enabled: boolean("enabled").default(true).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
  items: jsonb("items").notNull().$type<any[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Custom Curated Franchises / Collections
export const customFranchises = pgTable("custom_franchises", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  overview: text("overview"),
  posterPath: varchar("poster_path", { length: 500 }),
  backdropPath: varchar("backdrop_path", { length: 500 }),
  enabled: boolean("enabled").default(true).notNull(),
  parts: jsonb("parts").notNull().$type<any[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Spotlight Featured Hero Banner
export const siteSpotlight = pgTable("site_spotlight", {
  id: varchar("id", { length: 32 }).primaryKey().default("current"),
  enabled: boolean("enabled").default(false).notNull(),
  title: varchar("title", { length: 255 }),
  tagline: varchar("tagline", { length: 255 }),
  description: text("description"),
  backdropPath: varchar("backdrop_path", { length: 500 }),
  posterPath: varchar("poster_path", { length: 500 }),
  targetUrl: varchar("target_url", { length: 500 }),
  mediaType: varchar("media_type", { length: 32 }).default("movie"),
  badge: varchar("badge", { length: 64 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Site Appearance Settings
export const siteSettings = pgTable("site_settings", {
  id: varchar("id", { length: 32 }).primaryKey().default("current"),
  accentColor: varchar("accent_color", { length: 32 }).default("#7288AE").notNull(),
  heroStyle: varchar("hero_style", { length: 32 }).default("cinematic").notNull(),
  tagline: varchar("tagline", { length: 255 }).default("Movies. TV. Anime. All in one place.").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Custom Dynamic Themes Created by Admins
export const customThemes = pgTable("custom_themes", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => `custom_${crypto.randomUUID().slice(0, 8)}`),
  label: varchar("label", { length: 255 }).notNull(),
  tagline: varchar("tagline", { length: 255 }).default("Custom").notNull(),
  description: text("description"),
  background: varchar("background", { length: 32 }).default("#080C14").notNull(),
  card: varchar("card", { length: 32 }).default("#141C2B").notNull(),
  primary: varchar("primary", { length: 32 }).default("#38BDF8").notNull(),
  accent: varchar("accent", { length: 32 }).default("#F43F5E").notNull(),
  foreground: varchar("foreground", { length: 32 }).default("#E2E8F0").notNull(),
  preview: text("preview"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Issue Reports table
export const issueReports = pgTable("issue_reports", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  topic: varchar("topic", { length: 255 }).notNull(),
  message: text("message").notNull(),
  userEmail: varchar("user_email", { length: 255 }),
  status: varchar("status", { length: 32 }).default("open").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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


