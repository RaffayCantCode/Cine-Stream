import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const requestCache = new Map<string, { expires: number; data: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();

const CACHE_MAX_ENTRIES = 200;

function pruneCache(): void {
  if (requestCache.size <= CACHE_MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of requestCache) {
    if (entry.expires <= now) {
      requestCache.delete(key);
      if (requestCache.size <= CACHE_MAX_ENTRIES) return;
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
  // Admin and mutation endpoints are strictly real-time
  if (
    lower.includes("/api/admin/") ||
    lower.includes("/api/watch-history") ||
    lower.includes("/api/auth/")
  ) {
    return 0;
  }
  // Media details & episodes have 30-minute memory/session cache
  if (
    lower.includes("/api/tmdb/movie/") ||
    lower.includes("/api/tmdb/tv/") ||
    lower.includes("/api/anime/") ||
    lower.includes("/meta") ||
    lower.includes("/episodes") ||
    lower.includes("/api/manga/details") ||
    lower.includes("/api/manga/chapter")
  ) {
    return 1_800_000; // 30 minutes
  }
  if (lower.includes("/genre") || lower.includes("/providers") || lower.includes("/configuration")) {
    return 86_400_000; // 24 hours
  }
  if (lower.includes("/collection") || lower.includes("/franchise")) {
    return 14_400_000; // 4 hours
  }
  if (lower.includes("/popular") || lower.includes("/top-rated")) {
    return 3_600_000; // 1 hour
  }
  if (lower.includes("/trending") || lower.includes("/home")) {
    return 1_800_000; // 30 minutes
  }
  if (lower.includes("/logo")) {
    return 86_400_000 * 7; // 7 days
  }
  if (lower.includes("/search")) {
    return 900_000; // 15 minutes
  }
  return 1_800_000; // 30 minutes default
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

    // Check sessionStorage to survive page reloads and tab navigations with 0 requests
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(`fj_${cacheKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.expires > Date.now()) {
            requestCache.set(cacheKey, parsed);
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

    const isEmptyPayload =
      data === null ||
      data === undefined ||
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === "object" &&
        data &&
        "items" in (data as any) &&
        Array.isArray((data as any).items) &&
        (data as any).items.length === 0) ||
      (typeof data === "object" &&
        data &&
        "success" in (data as any) &&
        (data as any).success === false);

    if (shouldUseCache && cacheTtlMs > 0 && !isEmptyPayload) {
      const expires = Date.now() + cacheTtlMs;
      const entry = { data, expires };
      requestCache.set(cacheKey, entry);
      pruneCache();

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(`fj_${cacheKey}`, JSON.stringify(entry));
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
  const isAnimation = Array.isArray(item.genre_ids) && item.genre_ids.includes(16);
  return Boolean(isJapanese && isAnimation);
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
  id?: number;
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

    // For non-search (browse feeds), filter out explicitly adult/erotic titles
    if (!isSearch) {
      const titleText = `${item.title || ""} ${item.name || ""}`.toLowerCase();
      if (ADULT_KEYWORDS.some((keyword) => titleText.includes(keyword))) {
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
