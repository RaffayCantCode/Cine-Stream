import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const requestCache = new Map<string, { expires: number; data: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();

interface FetchJsonOptions extends RequestInit {
  cacheTtlMs?: number;
  skipCache?: boolean;
}

function getCacheKey(input: RequestInfo | URL, init?: RequestInit) {
  const method = init?.method ?? "GET";
  const headers = init?.headers ? JSON.stringify(init.headers) : "";
  return `${method}:${String(input)}:${headers}`;
}

export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: FetchJsonOptions
): Promise<T> {
  const { cacheTtlMs = 60_000, skipCache = false, ...requestInit } = init || {};
  const method = requestInit.method ?? "GET";
  const shouldUseCache = !skipCache && method.toUpperCase() === "GET";
  const cacheKey = getCacheKey(input, requestInit);

  if (shouldUseCache) {
    const cached = requestCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
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
      data = text;
    }

    if (!res.ok) {
      const message =
        typeof data === "object" && data && "error" in data
          ? String((data as { error: unknown }).error)
          : res.statusText || `Request failed: ${res.status}`;
      throw new Error(message);
    }

    if (shouldUseCache) {
      requestCache.set(cacheKey, { data, expires: Date.now() + cacheTtlMs });
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
    return;
  }

  for (const key of requestCache.keys()) {
    if (key.includes(match)) {
      requestCache.delete(key);
    }
  }
}

export function shuffleArray<T>(items: T[]): T[] {
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
  "hardcore", "softcore", "xxx", "mature", "nsfw",
];

export function isTmdbAnime(item: { original_language?: string; genre_ids?: number[] }): boolean {
  return item.original_language === "ja" &&
    Array.isArray(item.genre_ids) &&
    item.genre_ids.includes(16);
}

export function filterReleasedSafeContent<T extends {
  adult?: boolean;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  title?: string;
  name?: string;
  overview?: string;
}>(items: T[]): T[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return items.filter((item) => {
    if (item.adult === true) return false;

    const textToCheck = `${item.title || ""} ${item.name || ""} ${item.overview || ""}`.toLowerCase();
    if (ADULT_KEYWORDS.some((keyword) => textToCheck.includes(keyword))) {
      return false;
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
