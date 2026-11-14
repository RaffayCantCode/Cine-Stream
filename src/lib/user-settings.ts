"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { EpisodeViewMode } from "@/components/episodes/EpisodeViews";

export interface SiteSettings {
  episodeViewMode: EpisodeViewMode;
  autoNextEpisode: boolean;
  autoMarkPreviousWatched: boolean;
}

export const SITE_SETTINGS_KEY = "cinestream_site_settings_v1";
export const WATCHED_EPISODES_KEY = "cinestream_watched_episodes_v1";

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  episodeViewMode: "grid",
  autoNextEpisode: true,
  autoMarkPreviousWatched: true,
};

export function getSiteSettings(): SiteSettings {
  if (typeof window === "undefined") return DEFAULT_SITE_SETTINGS;
  try {
    const raw = localStorage.getItem(SITE_SETTINGS_KEY);
    if (!raw) return DEFAULT_SITE_SETTINGS;
    const parsed = JSON.parse(raw);
    const mode = parsed?.episodeViewMode;
    return {
      episodeViewMode:
        mode === "list" || mode === "grid" || mode === "numbers"
          ? mode
          : DEFAULT_SITE_SETTINGS.episodeViewMode,
      autoNextEpisode:
        typeof parsed?.autoNextEpisode === "boolean"
          ? parsed.autoNextEpisode
          : DEFAULT_SITE_SETTINGS.autoNextEpisode,
      autoMarkPreviousWatched:
        typeof parsed?.autoMarkPreviousWatched === "boolean"
          ? parsed.autoMarkPreviousWatched
          : DEFAULT_SITE_SETTINGS.autoMarkPreviousWatched,
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export function updateSiteSettings(partial: Partial<SiteSettings>): SiteSettings {
  const current = getSiteSettings();
  const next: SiteSettings = { ...current, ...partial };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("cinestream_settings_updated", { detail: next }));
    } catch {}
  }
  return next;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(() => getSiteSettings());

  useEffect(() => {
    setSettings(getSiteSettings());
    const handleUpdate = () => {
      setSettings(getSiteSettings());
    };
    window.addEventListener("cinestream_settings_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("cinestream_settings_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const update = useCallback((partial: Partial<SiteSettings>) => {
    const next = updateSiteSettings(partial);
    setSettings(next);
  }, []);

  const reset = useCallback(() => {
    const next = updateSiteSettings(DEFAULT_SITE_SETTINGS);
    setSettings(next);
  }, []);

  return { settings, updateSettings: update, resetSettings: reset };
}

// ── Watched Episodes Tracking ───────────────────────────────────────────────

interface WatchedEntry {
  episodes: number[];
  wasReset?: boolean;
  updatedAt: number;
}

type WatchedStore = Record<string, WatchedEntry>;

function buildWatchedScopeKey(
  mediaType: "tv" | "anime",
  mediaId: string | number,
  season: number = 1
): string {
  if (mediaType === "tv") {
    return `tv:${String(mediaId)}:s${Number(season) || 1}`;
  }
  return `anime:${String(mediaId)}:s${Number(season) || 1}`;
}

function readWatchedStore(): WatchedStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(WATCHED_EPISODES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeWatchedStore(store: WatchedStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WATCHED_EPISODES_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent("cinestream_watched_episodes_updated"));
  } catch {}
}

export function getWatchedEpisodesList(
  mediaType: "tv" | "anime",
  mediaId: string | number,
  season: number = 1
): { episodes: number[]; wasReset: boolean } {
  const store = readWatchedStore();
  const key = buildWatchedScopeKey(mediaType, mediaId, season);
  const entry = store[key];
  if (!entry) return { episodes: [], wasReset: false };
  return {
    episodes: Array.isArray(entry.episodes) ? entry.episodes : [],
    wasReset: Boolean(entry.wasReset),
  };
}

export function markEpisodesWatchedUpTo(
  mediaType: "tv" | "anime",
  mediaId: string | number,
  episodeNumber: number,
  season: number = 1
): number[] {
  const epNum = Math.floor(Number(episodeNumber) || 0);
  if (epNum <= 0 || !mediaId) return [];

  const settings = getSiteSettings();
  const store = readWatchedStore();
  const key = buildWatchedScopeKey(mediaType, mediaId, season);
  const existing = new Set<number>(store[key]?.episodes || []);

  if (settings.autoMarkPreviousWatched) {
    // Cap auto-fill to 2000 to avoid huge arrays on corrupt episode numbers
    const limit = Math.min(epNum, 2000);
    for (let i = 1; i <= limit; i++) {
      existing.add(i);
    }
  } else {
    existing.add(epNum);
  }

  const nextList = Array.from(existing).sort((a, b) => a - b);
  store[key] = {
    episodes: nextList,
    wasReset: false,
    updatedAt: Date.now(),
  };
  writeWatchedStore(store);
  return nextList;
}

export function resetWatchedEpisodes(
  mediaType: "tv" | "anime",
  mediaId: string | number,
  season?: number
): void {
  if (!mediaId) return;
  const store = readWatchedStore();

  if (season !== undefined) {
    const key = buildWatchedScopeKey(mediaType, mediaId, season);
    store[key] = {
      episodes: [],
      wasReset: true,
      updatedAt: Date.now(),
    };
  } else {
    const prefix = `${mediaType}:${String(mediaId)}:`;
    for (const k of Object.keys(store)) {
      if (k.startsWith(prefix)) {
        store[k] = {
          episodes: [],
          wasReset: true,
          updatedAt: Date.now(),
        };
      }
    }
  }

  writeWatchedStore(store);
}

export function clearAllWatchedEpisodes(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WATCHED_EPISODES_KEY);
    window.dispatchEvent(new CustomEvent("cinestream_watched_episodes_updated"));
  } catch {}
}

export function useWatchedEpisodes(
  mediaType: "tv" | "anime",
  mediaId: string | number | undefined | null,
  season: number = 1
) {
  const [state, setState] = useState<{ episodes: number[]; wasReset: boolean }>(() =>
    mediaId ? getWatchedEpisodesList(mediaType, mediaId, season) : { episodes: [], wasReset: false }
  );

  useEffect(() => {
    if (!mediaId) {
      setState({ episodes: [], wasReset: false });
      return;
    }
    const sync = () => {
      setState(getWatchedEpisodesList(mediaType, mediaId, season));
    };
    sync();
    window.addEventListener("cinestream_watched_episodes_updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cinestream_watched_episodes_updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [mediaType, mediaId, season]);

  const watchedSet = useMemo(() => new Set<number>(state.episodes), [state.episodes]);

  const markUpTo = useCallback(
    (episodeNumber: number, targetSeason?: number) => {
      if (!mediaId) return;
      markEpisodesWatchedUpTo(mediaType, mediaId, episodeNumber, targetSeason ?? season);
    },
    [mediaType, mediaId, season]
  );

  const reset = useCallback(
    (allSeasons: boolean = false) => {
      if (!mediaId) return;
      resetWatchedEpisodes(mediaType, mediaId, allSeasons ? undefined : season);
    },
    [mediaType, mediaId, season]
  );

  const isWatched = useCallback(
    (episodeNumber: number) => watchedSet.has(Number(episodeNumber)),
    [watchedSet]
  );

  return {
    watchedSet,
    watchedCount: state.episodes.length,
    hasWatchedAny: state.episodes.length > 0,
    wasReset: state.wasReset,
    isWatched,
    markWatchedUpTo: markUpTo,
    resetWatched: reset,
  };
}
