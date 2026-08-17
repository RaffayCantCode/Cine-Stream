import { getDefaultMovieOrder } from "./streaming-fetch";

export const SOURCE_TAGS = [
  "best",
  "good",
  "recommended",
  "not_working",
  "backup",
] as const;

export type SourceTag = (typeof SOURCE_TAGS)[number];

export function isSourceTag(value: unknown): value is SourceTag {
  return typeof value === "string" && (SOURCE_TAGS as readonly string[]).includes(value);
}

export const SOURCE_TAG_LABELS: Record<SourceTag, string> = {
  best: "Best",
  good: "Good",
  recommended: "Recommended",
  not_working: "Not Working",
  backup: "Backup",
};

export const TAG_STYLES: Record<SourceTag, string> = {
  best: "bg-emerald-400/15 text-emerald-300 border-emerald-300/25",
  good: "bg-sky-400/15 text-sky-300 border-sky-300/25",
  recommended: "bg-violet-400/15 text-violet-300 border-violet-300/25",
  not_working: "bg-rose-400/15 text-rose-300 border-rose-300/25",
  backup: "bg-zinc-400/15 text-zinc-300 border-zinc-300/25",
};

export type SourceCategory = "movie" | "anime";

export interface SourceConfigEntry {
  key: string;
  tag: SourceTag;
}

// Default source order for anime (movies/TV order is derived from STREAMING_APIS
// in streaming-fetch.ts via getDefaultMovieOrder). Keep in sync with the
// PROVIDERS array in AnimePlayer.tsx.
export const ANIME_SOURCE_KEYS: string[] = ["animepahe", "vidnest", "vidlink", "123embed", "autoembed"];

export const MOVIE_SOURCE_KEYS: string[] = getDefaultMovieOrder();

// Default tag per source when the admin has not overridden it.
// Follows position: 1=recommended, 2=best, 3=best, 4=good, 5=backup.
export const DEFAULT_TAGS: Record<SourceCategory, Record<string, SourceTag>> = {
  movie: {
    vidsrc: "recommended",
    vixsrc: "best",
    videasy: "best",
    vidlink: "good",
    autoembed: "backup",
  },
  anime: {
    animepahe: "recommended",
    vidnest: "best",
    vidlink: "best",
    "123embed": "good",
    autoembed: "backup",
  },
};

export function defaultSourceOrder(category: SourceCategory): string[] {
  return category === "movie" ? MOVIE_SOURCE_KEYS : ANIME_SOURCE_KEYS;
}

// Merge stored overrides (category, sourceKey -> position, tag) with the
// hard-coded default order/tags. Returns the effective ordered list.
export function resolveSourceConfig(
  category: SourceCategory,
  rows: { sourceKey: string; position: number; tag: string }[]
): SourceConfigEntry[] {
  const baseKeys = defaultSourceOrder(category);
  const byKey = new Map(rows.map((r) => [r.sourceKey, r]));
  const defaults = DEFAULT_TAGS[category];

  const entries = baseKeys.map((key, index) => {
    const row = byKey.get(key);
    return {
      key,
      tag: row && isSourceTag(row.tag) ? row.tag : (defaults[key] ?? "good"),
      position: row ? Number(row.position) || 0 : index,
    };
  });

  entries.sort((a, b) => a.position - b.position);
  return entries.map(({ key, tag }) => ({ key, tag }));
}

// Client-side fetch with a short module cache so rapid episode/page switches
// don't hammer the API while admin saves still apply within ~30s.
let fetchCache: { ts: number; data: Record<SourceCategory, SourceConfigEntry[]> } | null = null;

export async function fetchSourceConfig(): Promise<Record<SourceCategory, SourceConfigEntry[]>> {
  if (fetchCache && Date.now() - fetchCache.ts < 30000) {
    return fetchCache.data;
  }
  try {
    const res = await fetch("/api/stream/sources", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const data = json.data as Record<SourceCategory, SourceConfigEntry[]>;
        fetchCache = { ts: Date.now(), data };
        return data;
      }
    }
  } catch {}
  return { movie: [], anime: [] };
}