export const runtime = "edge";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isThemeId, ThemeId, DEFAULT_THEME } from "@/lib/themes";

const episodeModeEnum = z.enum(["list", "grid", "numbers"]);

const settingsSchema = z.object({
  episodeViewMode: episodeModeEnum.optional(),
  tvEpisodeViewMode: episodeModeEnum.optional(),
  animeEpisodeViewMode: episodeModeEnum.optional(),
  autoNextEpisode: z.boolean().optional(),
  autoMarkPreviousWatched: z.boolean().optional(),
});

const preferencesPatchSchema = z.object({
  theme: z.string().max(64).optional(),
  settings: settingsSchema.optional(),
});

interface StoredUserPreferences {
  theme: ThemeId;
  settings: {
    episodeViewMode: "list" | "grid" | "numbers";
    tvEpisodeViewMode: "list" | "grid" | "numbers";
    animeEpisodeViewMode: "list" | "grid" | "numbers";
    autoNextEpisode: boolean;
    autoMarkPreviousWatched: boolean;
  } | null;
  updatedAt: number;
  hasSavedPreferences: boolean;
}

function parseStoredPreferences(raw: string | null | undefined): StoredUserPreferences {
  if (!raw) {
    return {
      theme: DEFAULT_THEME,
      settings: null,
      updatedAt: 0,
      hasSavedPreferences: false,
    };
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const theme: ThemeId = isThemeId(parsed?.theme) ? parsed.theme : DEFAULT_THEME;
      const rawSettings = parsed?.settings;
      let settings: StoredUserPreferences["settings"] = null;
      if (rawSettings && typeof rawSettings === "object") {
        const validMode = (m: unknown): "list" | "grid" | "numbers" =>
          m === "list" || m === "grid" || m === "numbers" ? m : "grid";
        const tvMode = validMode(rawSettings.tvEpisodeViewMode ?? rawSettings.episodeViewMode);
        const animeMode = validMode(rawSettings.animeEpisodeViewMode ?? rawSettings.episodeViewMode);
        settings = {
          episodeViewMode: tvMode,
          tvEpisodeViewMode: tvMode,
          animeEpisodeViewMode: animeMode,
          autoNextEpisode:
            typeof rawSettings.autoNextEpisode === "boolean" ? rawSettings.autoNextEpisode : true,
          autoMarkPreviousWatched:
            typeof rawSettings.autoMarkPreviousWatched === "boolean"
              ? rawSettings.autoMarkPreviousWatched
              : true,
        };
      }
      return {
        theme,
        settings,
        updatedAt: typeof parsed?.updatedAt === "number" ? parsed.updatedAt : Date.now(),
        hasSavedPreferences: true,
      };
    } catch {}
  }

  if (isThemeId(trimmed)) {
    return {
      theme: trimmed,
      settings: null,
      updatedAt: 0,
      // "global" is the default SQLite column value on newly created rows
      hasSavedPreferences: trimmed !== DEFAULT_THEME,
    };
  }

  return {
    theme: DEFAULT_THEME,
    settings: null,
    updatedAt: 0,
    hasSavedPreferences: false,
  };
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json(
      { theme: null, settings: null, updatedAt: 0, hasSavedPreferences: false },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  try {
    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const prefs = parseStoredPreferences(user?.theme);
    return Response.json(prefs, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    });
  } catch (error) {
    console.error("[preferences] GET error:", error);
    return Response.json(
      { theme: null, settings: null, updatedAt: 0, hasSavedPreferences: false },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = preferencesPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid preferences payload" }, { status: 400 });
  }

  try {
    const db = getDb();
    const existingUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const currentPrefs = parseStoredPreferences(existingUser?.theme);

    const nextTheme: ThemeId =
      parsed.data.theme !== undefined
        ? isThemeId(parsed.data.theme)
          ? parsed.data.theme
          : DEFAULT_THEME
        : currentPrefs.theme;

    const baseSettings = currentPrefs.settings ?? {
      episodeViewMode: "grid" as const,
      tvEpisodeViewMode: "grid" as const,
      animeEpisodeViewMode: "grid" as const,
      autoNextEpisode: true,
      autoMarkPreviousWatched: true,
    };

    const incomingSettings = parsed.data.settings;
    const nextTvMode =
      incomingSettings?.tvEpisodeViewMode ??
      incomingSettings?.episodeViewMode ??
      baseSettings.tvEpisodeViewMode;
    const nextAnimeMode =
      incomingSettings?.animeEpisodeViewMode ?? baseSettings.animeEpisodeViewMode;

    const nextSettings = incomingSettings
      ? {
          episodeViewMode: nextTvMode,
          tvEpisodeViewMode: nextTvMode,
          animeEpisodeViewMode: nextAnimeMode,
          autoNextEpisode:
            incomingSettings.autoNextEpisode ?? baseSettings.autoNextEpisode,
          autoMarkPreviousWatched:
            incomingSettings.autoMarkPreviousWatched ?? baseSettings.autoMarkPreviousWatched,
        }
      : currentPrefs.settings;

    const updatedAt = Date.now();
    const serialized = JSON.stringify({
      theme: nextTheme,
      settings: nextSettings,
      updatedAt,
    });

    await db.update(users).set({ theme: serialized }).where(eq(users.id, userId));

    return Response.json(
      {
        theme: nextTheme,
        settings: nextSettings,
        updatedAt,
        hasSavedPreferences: true,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[preferences] PATCH error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
