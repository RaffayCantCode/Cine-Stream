import * as fs from "fs";
import * as path from "path";

const backupPath = "./backup_data/neon_data.json";
if (!fs.existsSync(backupPath)) {
  console.error("Missing backup_data/neon_data.json");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

const ddlStatements = [
  `-- CineStream Cloudflare D1 Schema DDL
-- Generated for Database ID: 0e5943db-bc2f-4e30-b02d-f420957b16e4

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT,
  "email" TEXT UNIQUE,
  "emailVerified" INTEGER,
  "image" TEXT,
  "password" TEXT,
  "theme" TEXT DEFAULT 'global' NOT NULL,
  "role" TEXT DEFAULT 'user' NOT NULL,
  "status" TEXT DEFAULT 'active' NOT NULL,
  "lastActiveAt" INTEGER,
  "createdAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "account" (
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  PRIMARY KEY ("provider", "providerAccountId")
);

CREATE TABLE IF NOT EXISTS "session" (
  "sessionToken" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "expires" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "verificationToken" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" INTEGER NOT NULL,
  PRIMARY KEY ("identifier", "token")
);

CREATE TABLE IF NOT EXISTS "watch_history" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "media_id" INTEGER NOT NULL,
  "media_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "poster_path" TEXT,
  "backdrop_path" TEXT,
  "season" INTEGER DEFAULT 0 NOT NULL,
  "episode" INTEGER DEFAULT 0 NOT NULL,
  "episode_name" TEXT,
  "progress" INTEGER DEFAULT 0,
  "duration" INTEGER DEFAULT 0,
  "watched_at" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_watch_history" ON "watch_history" ("user_id", "media_id", "media_type", "season", "episode");

CREATE TABLE IF NOT EXISTS "watchlist" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "media_id" INTEGER NOT NULL,
  "media_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "poster_path" TEXT,
  "backdrop_path" TEXT,
  "created_at" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_watchlist_user_media" ON "watchlist" ("user_id", "media_id", "media_type");

CREATE TABLE IF NOT EXISTS "manga_reading_history" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "manga_id" TEXT NOT NULL,
  "manga_title" TEXT NOT NULL,
  "manga_cover" TEXT NOT NULL,
  "manga_type" TEXT DEFAULT 'manga' NOT NULL,
  "chapter_id" TEXT NOT NULL,
  "chapter_number" TEXT NOT NULL,
  "chapter_title" TEXT,
  "page_number" INTEGER DEFAULT 1 NOT NULL,
  "total_pages" INTEGER DEFAULT 1 NOT NULL,
  "next_chapter_id" TEXT,
  "next_chapter_number" TEXT,
  "updated_at" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_manga_reading_user_manga" ON "manga_reading_history" ("user_id", "manga_id");

CREATE TABLE IF NOT EXISTS "manga_bookmarks" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "manga_id" TEXT NOT NULL,
  "media_type" TEXT DEFAULT 'manga' NOT NULL,
  "title" TEXT NOT NULL,
  "poster_path" TEXT,
  "backdrop_path" TEXT,
  "created_at" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_manga_bookmarks_user_manga" ON "manga_bookmarks" ("user_id", "manga_id");

CREATE TABLE IF NOT EXISTS "site_announcements" (
  "id" TEXT PRIMARY KEY DEFAULT 'current' NOT NULL,
  "message" TEXT,
  "updated_by" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "custom_home_sections" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "icon" TEXT,
  "enabled" INTEGER DEFAULT 1 NOT NULL,
  "order_index" INTEGER DEFAULT 0 NOT NULL,
  "items" TEXT DEFAULT '[]' NOT NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "custom_franchises" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "overview" TEXT,
  "poster_path" TEXT,
  "backdrop_path" TEXT,
  "enabled" INTEGER DEFAULT 1 NOT NULL,
  "parts" TEXT DEFAULT '[]' NOT NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_spotlight" (
  "id" TEXT PRIMARY KEY DEFAULT 'current' NOT NULL,
  "enabled" INTEGER DEFAULT 0 NOT NULL,
  "title" TEXT,
  "tagline" TEXT,
  "description" TEXT,
  "backdrop_path" TEXT,
  "poster_path" TEXT,
  "target_url" TEXT,
  "media_type" TEXT DEFAULT 'movie',
  "badge" TEXT,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" TEXT PRIMARY KEY DEFAULT 'current' NOT NULL,
  "accent_color" TEXT DEFAULT '#7288AE' NOT NULL,
  "hero_style" TEXT DEFAULT 'cinematic' NOT NULL,
  "tagline" TEXT DEFAULT 'Movies. TV. Anime. All in one place.' NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "custom_themes" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "label" TEXT NOT NULL,
  "tagline" TEXT DEFAULT 'Custom' NOT NULL,
  "description" TEXT,
  "background" TEXT DEFAULT '#080C14' NOT NULL,
  "card" TEXT DEFAULT '#141C2B' NOT NULL,
  "primary" TEXT DEFAULT '#38BDF8' NOT NULL,
  "accent" TEXT DEFAULT '#F43F5E' NOT NULL,
  "foreground" TEXT DEFAULT '#E2E8F0' NOT NULL,
  "preview" TEXT,
  "enabled" INTEGER DEFAULT 1 NOT NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "streaming_source_config" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "category" TEXT NOT NULL,
  "source_key" TEXT NOT NULL,
  "position" INTEGER DEFAULT 0 NOT NULL,
  "tag" TEXT DEFAULT 'good' NOT NULL,
  "updated_at" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_streaming_source_category_key" ON "streaming_source_config" ("category", "source_key");

CREATE TABLE IF NOT EXISTS "issue_reports" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "topic" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "user_email" TEXT,
  "status" TEXT DEFAULT 'open' NOT NULL,
  "created_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "media_overrides" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "media_type" TEXT NOT NULL,
  "media_id" TEXT NOT NULL,
  "status" TEXT DEFAULT 'default' NOT NULL,
  "is_hidden" INTEGER DEFAULT 0 NOT NULL,
  "is_upcoming" INTEGER DEFAULT 0 NOT NULL,
  "is_unavailable" INTEGER DEFAULT 0 NOT NULL,
  "custom_title" TEXT,
  "custom_description" TEXT,
  "custom_genres" TEXT DEFAULT '[]',
  "custom_release_date" TEXT,
  "custom_poster" TEXT,
  "custom_backdrop" TEXT,
  "custom_tags" TEXT DEFAULT '[]',
  "notes" TEXT,
  "updated_by" TEXT,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_media_overrides_type_id" ON "media_overrides" ("media_type", "media_id");
`
];

function escapeSqlVal(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "number") return Number.isFinite(val) ? val.toString() : "NULL";
  if (typeof val === "object") {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.getTime().toString();
      }
    }
    return `'${val.replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

const tableOrder = [
  "user",
  "account",
  "session",
  "verificationToken",
  "watch_history",
  "watchlist",
  "manga_reading_history",
  "manga_bookmarks",
  "site_announcements",
  "custom_home_sections",
  "custom_franchises",
  "site_spotlight",
  "site_settings",
  "custom_themes",
  "streaming_source_config",
  "issue_reports",
  "media_overrides",
];

const insertStatements = [];

for (const table of tableOrder) {
  const rows = data[table] || [];
  if (rows.length === 0) continue;

  for (const row of rows) {
    const cols = Object.keys(row);
    const colNames = cols.map(c => `"${c}"`).join(", ");
    const colVals = cols.map(c => escapeSqlVal(row[c])).join(", ");
    insertStatements.push(`INSERT OR REPLACE INTO "${table}" (${colNames}) VALUES (${colVals});`);
  }
}

const schemaSql = ddlStatements.join("\n\n");
const seedSql = insertStatements.join("\n");
const fullSql = schemaSql + "\n\n-- SEED DATA\n" + seedSql;

fs.writeFileSync("./backup_data/d1_schema.sql", schemaSql, "utf-8");
fs.writeFileSync("./backup_data/d1_seed.sql", seedSql, "utf-8");
fs.writeFileSync("./backup_data/d1_full_migration.sql", fullSql, "utf-8");

console.log(`Generated ./backup_data/d1_schema.sql`);
console.log(`Generated ./backup_data/d1_seed.sql (${insertStatements.length} rows)`);
console.log(`Generated ./backup_data/d1_full_migration.sql`);
