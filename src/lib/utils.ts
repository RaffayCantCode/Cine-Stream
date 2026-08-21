import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const requestCache = new Map<string, { expires: number; data: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();

const CACHE_MAX_ENTRIES = 50;

function pruneCache(): void {
  if (requestCache.size <= CACHE_MAX_ENTRIES) return;
  const now = Date.now();
  let deleted = 0;
  for (const [key, entry] of requestCache) {
    if (entry.expires <= now) {
      requestCache.delete(key);
      deleted++;
      if (requestCache.size <= CACHE_MAX_ENTRIES) break;
    }
  }
  if (requestCache.size > CACHE_MAX_ENTRIES) {
    const toDelete = requestCache.size - CACHE_MAX_ENTRIES;
    const iter = requestCache.keys();
    for (let i = 0; i < toDelete; i++) {
      const k = iter.next();
      if (k.done) break;
      requestCache.delete(k.value);
    }
  }
}

interface FetchJsonOptions extends RequestInit {
  cacheTtlMs?: number;
  skipCache?: boolean;
}

function getCacheKey(input: RequestInfo | URL, init?: RequestInit) {
  const method = init?.method ?? "GET";
  const headers = init?.headers ? JSON.stringify(init.headers) : "";
  return `${method}:${String(input)}:${headers}`;
}

function getSmartTtlMs(urlStr: string): number {
  const lower = urlStr.toLowerCase();
  // Dynamic media details and admin endpoints must never be cached in persistent storage
  if (
    lower.includes("/api/admin/") ||
    lower.includes("/api/tmdb/movie/") ||
    lower.includes("/api/tmdb/tv/") ||
    lower.includes("/api/anime/") ||
    lower.includes("/meta") ||
    lower.includes("/episodes")
  ) {
    return 0; // Fresh real-time data
  }
  if (lower.includes("/genre") || lower.includes("/providers") || lower.includes("/configuration")) {
    return 86_400_000; // 24 hours
  }
  if (lower.includes("/collection") || lower.includes("/franchise")) {
    return 43_200_000; // 12 hours
  }
  if (lower.includes("/popular") || lower.includes("/top-rated")) {
    return 3_600_000; // 1 hour
  }
  if (lower.includes("/trending")) {
    return 1_800_000; // 30 minutes
  }
  if (lower.includes("/search")) {
    return 900_000; // 15 minutes
  }
  return 900_000; // 15 minutes default
}

export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: FetchJsonOptions
): Promise<T> {
  const urlStr = String(input);
  const { cacheTtlMs = getSmartTtlMs(urlStr), skipCache = false, ...requestInit } = init || {};
  const method = requestInit.method ?? "GET";
  const shouldUseCache = !skipCache && method.toUpperCase() === "GET" && cacheTtlMs > 0;
  const cacheKey = getCacheKey(input, requestInit);

  if (shouldUseCache) {
    const cached = requestCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }

    // Try sessionStorage cache for fast cross-page hydration
    if (typeof window !== "undefined" && cacheTtlMs >= 60_000) {
      try {
        const storedStr = sessionStorage.getItem(`cs_v16_cache_${cacheKey}`);
        if (storedStr) {
          const parsed = JSON.parse(storedStr);
          if (parsed && parsed.expires > Date.now()) {
            requestCache.set(cacheKey, { data: parsed.data, expires: parsed.expires });
            return parsed.data as T;
          }
        }
      } catch {}
    }

    const pending = pendingRequests.get(cacheKey);
    if (pending) {
      return pending as Promise<T>;
    }
  }

  const request = (async () => {
    const res = await fetch(input, requestInit);
    const text = await res.text();
    let data: unknown = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const message =
        typeof data === "object" && data && "error" in data
          ? String((data as { error: unknown }).error)
          : res.statusText || `Request failed: ${res.status}`;
      throw new Error(message);
    }

    if (shouldUseCache && cacheTtlMs > 0) {
      const expires = Date.now() + cacheTtlMs;
      requestCache.set(cacheKey, { data, expires });
      pruneCache();

      if (typeof window !== "undefined" && cacheTtlMs >= 60_000) {
        try {
          sessionStorage.setItem(`cs_v16_cache_${cacheKey}`, JSON.stringify({ data, expires }));
        } catch {}
      }
    }

    return data as T;
  })();

  if (shouldUseCache) {
    pendingRequests.set(cacheKey, request as Promise<unknown>);
    request.finally(() => pendingRequests.delete(cacheKey));
  }

  return request;
}

export function clearFetchJsonCache(match?: string) {
  if (!match) {
    requestCache.clear();
    pendingRequests.clear();
    if (typeof window !== "undefined") {
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && (k.startsWith("cs_v") || k.includes("cache"))) {
            toRemove.push(k);
          }
        }
        for (const k of toRemove) {
          sessionStorage.removeItem(k);
        }
      } catch {}
    }
    return;
  }

  for (const key of requestCache.keys()) {
    if (key.includes(match)) {
      requestCache.delete(key);
    }
  }
  for (const key of pendingRequests.keys()) {
    if (key.includes(match)) {
      pendingRequests.delete(key);
    }
  }
  if (typeof window !== "undefined") {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.includes(match)) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) {
        sessionStorage.removeItem(k);
      }
    } catch {}
  }
}

export function clearAllClientCaches(): void {
  clearFetchJsonCache();
}

export function shuffleArray<T>(items: T[] | null | undefined): T[] {
  if (!Array.isArray(items)) return [];
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ADULT_KEYWORDS = [
  "porn", "adult", "erotic", "sex", "nude", "nudity", "explicit",
  "hardcore", "softcore", "xxx", "nsfw",
  "onlyfans", "camgirl", "webcam", "striptease", "burlesque", "erotica",
  "masturbation", "orgy", "bdsm", "fetish", "provocative", "seduction",
  "taboo", "playboy", "18+", "r18", "adults only", "mature audience",
  "sensual", "lust", "passion", "naked", "escort", "gigolo", "swinger",
  "swingers", "erotique", "erotico", "erotism", "strip", "pleasure",
  "affair", "mistress", "adultery", "intercourse", "fetishism", "hentai",
  "eroticism", "eroticas", "camshow", "sensuality", "erotisme", "orgasm",
  "kamasutra", "voyeur", "seduce", "seduced", "seduction",
  "sexual", "erotikus", "erotyk", "erotiek", "erotik",
  "sexo", "sexu", "sexe", "sexy",
  "desnuda", "desnudo", "spogliarello",
  "strip club", "strip tease",
  "lingerie",
  "gay", "lesbian", "homosexual", "bisexual", "lgbt", "lgbtq",
  "transgender", "tranny",
  "shemale", "crossdress",
  "bondage", "dominatrix", "domination", "submission",
  "intimate", "forbidden", "temptation", "desire",
  "naked", "topless", "bottomless",
  "sesso", "pornografia", "erotismo",
  "adulto", "adulta", "sexually",
  "18禁",
];

export function isTmdbAnime(item: { original_language?: string; genre_ids?: number[]; origin_country?: string[] }): boolean {
  if (!item) return false;
  const isJapanese = item.original_language === "ja" || (Array.isArray(item.origin_country) && item.origin_country.includes("JP"));
  return Boolean(isJapanese);
}

/**
 * Strips Japanese anime entries from a TMDB result array.
 *
 * Anime is identified by the combination of:
 *   - original_language === "ja"  (Japanese origin)
 *   - genre_ids includes 16       (Animation genre)
 *
 * This deliberately preserves western animation (Pixar, Disney, DreamWorks)
 * which are typically English-language, and avoids false positives on
 * live-action Japanese content which won't have genre 16.
 *
 * Use this in Movies, TV Shows, and Search pipelines only.
 * Do NOT use it inside the Anime section — which has its own independent providers.
 */
export function filterExcludeAnime<T extends { original_language?: string; genre_ids?: number[] }>(
  items: T[]
): T[] {
  return items.filter((item) => !isTmdbAnime(item));
}

export function filterReleasedSafeContent<T extends {
  adult?: boolean;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  title?: string;
  name?: string;
  overview?: string;
}>(items: T[], isSearch = false): T[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return items.filter((item) => {
    // Explicit override for Obsession 2026
    if ((item as any).id === 1339713) return true;

    if (item.adult === true) return false;

    const textToCheck = `${item.title || ""} ${item.name || ""} ${item.overview || ""}`.toLowerCase();
    
    // For non-search (browse feeds), filter aggressively out any softcore/erotic titles
    if (!isSearch) {
      if (ADULT_KEYWORDS.some((keyword) => textToCheck.includes(keyword))) {
        return false;
      }
    } else {
      // In search, allow moderate/R-rated/softcore titles to be found, but block hardcore items
      const hardcoreKeywords = ["porn", "hardcore", "xxx", "onlyfans", "camgirl", "webcam", "masturbation", "orgy", "adults only"];
      if (hardcoreKeywords.some((keyword) => textToCheck.includes(keyword))) {
        return false;
      }
    }

    const releaseStr = item.release_date || item.first_air_date;
    if (releaseStr) {
      const releaseDate = new Date(releaseStr);
      if (!isNaN(releaseDate.getTime()) && releaseDate > today) {
        return false;
      }
    }

    return true;
  });
}

export function getRecommendationReason(sourceGenres: number[], targetGenres: number[], title?: string): string {
  if (!sourceGenres || !targetGenres || sourceGenres.length === 0 || targetGenres.length === 0) {
    return "Recommended for you";
  }
  
  const matches = sourceGenres.filter(g => targetGenres.includes(g)).length;
  
  if (matches >= 3) return "Similar story and themes";
  if (matches === 2) return "Similar atmosphere";
  if (matches === 1) return "Similar genre";
  
  return "Recommended for you";
}
