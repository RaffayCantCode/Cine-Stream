/**
 * Manga and Manhwa Fetching Engine
 * Primary Source: WeebCentral Engine (https://weebcentral.com)
 * Secondary Source: Asura Scans Engine (https://api.asurascans.com)
 */

export interface MangaItem {
  id: string;
  title: string;
  altTitles?: string[];
  description: string;
  coverImage: string;
  bannerImage?: string;
  type: "manga" | "manhwa" | "manhua";
  status: "ongoing" | "completed" | "hiatus" | "cancelled";
  releaseYear?: number | null;
  authors?: string[];
  artists?: string[];
  tags: string[];
  contentRating: "safe" | "suggestive" | "erotica" | "pornographic";
  originalLanguage: string;
  lastChapter?: string | null;
  totalChapters?: number | null;
  followedCount?: number;
  ratingScore?: number;
  source?: "weebcentral" | "asura";
}

export interface MangaChapter {
  id: string;
  chapterNumber: string;
  volumeNumber?: string | null;
  title?: string | null;
  language: string;
  pagesCount: number;
  publishAt: string;
  scanlationGroup?: string | null;
  externalUrl?: string | null;
  source?: "weebcentral" | "asura";
}

export interface ChapterPagesData {
  chapterId: string;
  chapterNumber: string;
  mangaId: string;
  pageUrls: string[];
  dataSaverUrls: string[];
}

const WEEBCENTRAL_BASE = "https://weebcentral.com";
const ASURA_API = "https://api.asurascans.com/api";

// Bump this whenever fetch logic or data shape changes to instantly drop stale in-memory cache
const CACHE_VERSION = "v4";

// High-speed in-memory response cache
const serverCache = new Map<string, { data: any; expiry: number }>();
const inFlightRequests = new Map<string, Promise<any>>();

function ck(key: string) {
  return `${CACHE_VERSION}:${key}`;
}

function getFromCache<T>(key: string): T | null {
  const item = serverCache.get(ck(key));
  if (!item) return null;
  if (Date.now() > item.expiry) {
    serverCache.delete(ck(key));
    return null;
  }
  return item.data as T;
}

function setInCache(key: string, data: any, ttlSeconds = 1800): void {
  if (serverCache.size > 500) {
    const iter = serverCache.keys();
    for (let i = 0; i < 100; i++) {
      const next = iter.next();
      if (next.done) break;
      serverCache.delete(next.value);
    }
  }
  serverCache.set(ck(key), { data, expiry: Date.now() + ttlSeconds * 1000 });
}


async function dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
        ...options.headers,
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .trim();
}

/**
 * Parses WeebCentral search / list HTML into standardized MangaItem array.
 */
function parseWeebCentralHtml(html: string): MangaItem[] {
  if (!html) return [];
  const items: MangaItem[] = [];
  const seen = new Set<string>();

  // Split by top-level article or fallback to generic article tag
  const articleBlocks = html.split(/<article\b[^>]*class="[^"]*bg-base-300[^"]*"[^>]*>/i);
  const blocks = articleBlocks.length > 1 ? articleBlocks.slice(1) : html.split(/<article\b[^>]*>/i).slice(1);

  for (const block of blocks) {
    const linkMatch = block.match(/href="(?:https?:\/\/weebcentral\.com)?\/series\/([A-Z0-9]+)\/([^"'\s>]+)"/i);
    if (!linkMatch) continue;

    const rawId = linkMatch[1];
    const id = `wc-${rawId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const slug = linkMatch[2];

    const titleMatch =
      block.match(/class="[^"]*link[^"]*line-clamp-[^"]*"[^>]*>([^<]+)<\/a>/i) ||
      block.match(/class="[^"]*line-clamp-[^"]*link[^"]*"[^>]*>([^<]+)<\/a>/i) ||
      block.match(/alt="([^"]+?)\s+cover"/i) ||
      block.match(/<a[^>]*\/series\/[^>]*>([^<]+)<\/a>/i);

    const rawTitle = titleMatch ? titleMatch[1].trim() : decodeURIComponent(slug.replace(/-/g, " "));
    const title = decodeHtmlEntities(rawTitle);

    const coverMatch =
      block.match(/srcset="(https:\/\/[^"\s]+\.(?:webp|jpg|jpeg|png))"/i) ||
      block.match(/src="(https:\/\/[^"\s]+\.(?:webp|jpg|jpeg|png))"/i) ||
      block.match(/(https:\/\/(?:temp\.compsci88\.com|weebcentral\.com|cdn\.[^"'\s]+)\/[^\s"']+)/i);
    const coverImage = coverMatch ? coverMatch[1] || coverMatch[0] : "/icon-512.png";

    const yearMatch = block.match(/<strong>\s*Year:\s*<\/strong>\s*<span>(\d+)<\/span>/i);
    const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

    const statusMatch = block.match(/<strong>\s*Status:\s*<\/strong>\s*<span>([^<]+)<\/span>/i);
    const status = (statusMatch ? statusMatch[1].trim().toLowerCase() : "ongoing") as any;

    const typeMatch = block.match(/<strong>\s*Type:\s*<\/strong>\s*<span>([^<]+)<\/span>/i);
    const rawType = typeMatch ? typeMatch[1].trim().toLowerCase() : "manga";
    let type: "manga" | "manhwa" | "manhua" = "manga";
    if (rawType.includes("manhwa") || slug.toLowerCase().includes("manhwa")) type = "manhwa";
    else if (rawType.includes("manhua")) type = "manhua";

    const tagsMatch = block.match(/<strong>\s*Tag\(s\):\s*<\/strong>([\s\S]*?)<\/div>/i);
    const tags = tagsMatch
      ? [...tagsMatch[1].matchAll(/<span>\s*([^<,]+),?\s*<\/span>/g)].map((m) => decodeHtmlEntities(m[1].trim()))
      : [];

    items.push({
      id,
      title,
      description: `Read ${title} on CineStream.`,
      coverImage,
      bannerImage: coverImage,
      type,
      status,
      releaseYear,
      tags,
      contentRating: "safe",
      originalLanguage: "en",
      source: "weebcentral",
    });
  }

  return items;
}

/**
 * Fetches popular series directly from Asura Scans API.
 */
async function getAsuraPopularSeries(limit = 32): Promise<MangaItem[]> {
  try {
    const res = await fetchWithTimeout(`${ASURA_API}/series?page=1&limit=${limit}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 1800 },
    } as any, 5000);
    if (!res.ok) return [];
    const data = await res.json();
    const seriesList = data.data || [];

    return seriesList.map((s: any) => ({
      id: `asura-${s.slug}`,
      title: decodeHtmlEntities(s.title || s.slug),
      altTitles: s.alt_titles || [],
      description:
        decodeHtmlEntities((s.description || "").replace(/<[^>]+>/g, "").trim()) ||
        `Read ${s.title} on CineStream.`,
      coverImage: s.cover || s.cover_url || s.thumbnail_url || "/icon-512.png",
      bannerImage: s.banner || s.cover || "/icon-512.png",
      type: "manhwa" as const,
      status: (s.status?.toLowerCase() === "completed" ? "completed" : "ongoing") as any,
      releaseYear: s.release_year || null,
      tags: Array.isArray(s.genres)
        ? s.genres.map((g: any) => (typeof g === "string" ? g : g.name || "Action"))
        : ["Action", "Manhwa", "Fantasy"],
      contentRating: "safe" as const,
      originalLanguage: "ko",
      source: "asura" as const,
    }));
  } catch (err) {
    console.warn("[MangaFetch] Asura getAsuraPopularSeries failed:", err);
    return [];
  }
}

/**
 * Fetches real-time Trending Now with guaranteed equal Manga + Manhwa split.
 * Fetches half from Manhwa and half from Manga in parallel, then interleaves them.
 */
export async function getMangaTrending(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_trending_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  return dedupeRequest(cacheKey, async () => {
    const half = Math.ceil(limit / 2);

    try {
      // Fetch dynamic daily trending Manhwa and Manga in parallel (using Popularity for live daily trends)
      const [manhwaRes, mangaRes] = await Promise.all([
        fetchWithTimeout(
          `${WEEBCENTRAL_BASE}/search/data?included_type=Manhwa&sort=Popularity&order=Descending&official=Any&anime=Any&adult=False&limit=${half}`,
          { headers: { "HX-Request": "true" }, next: { revalidate: 900 } } as any,
          5000
        ).catch(() => null),
        fetchWithTimeout(
          `${WEEBCENTRAL_BASE}/search/data?included_type=Manga&sort=Popularity&order=Descending&official=Any&anime=Any&adult=False&limit=${half}`,
          { headers: { "HX-Request": "true" }, next: { revalidate: 900 } } as any,
          5000
        ).catch(() => null),
      ]);

      let manhwaItems: MangaItem[] = [];
      let mangaItems: MangaItem[] = [];

      if (manhwaRes && manhwaRes.ok) {
        manhwaItems = parseWeebCentralHtml(await manhwaRes.text());
      }
      if (mangaRes && mangaRes.ok) {
        mangaItems = parseWeebCentralHtml(await mangaRes.text());
      }

      // Interleave: Manhwa, Manga, Manhwa, Manga...
      const combined: MangaItem[] = [];
      const maxLen = Math.max(manhwaItems.length, mangaItems.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < manhwaItems.length) combined.push(manhwaItems[i]);
        if (i < mangaItems.length) combined.push(mangaItems[i]);
      }

      if (combined.length > 0) {
        const result = combined.slice(0, limit);
        setInCache(cacheKey, result, 900);
        return result;
      }
    } catch (err) {
      console.warn("[MangaFetch] WeebCentral getMangaTrending failed:", err);
    }

    // Fallback 1: Balanced search (already does 50/50 interleave internally)
    try {
      const fallbackSearch = await searchManga("", { type: "all", limit, sortBy: "rating" });
      if (fallbackSearch.items && fallbackSearch.items.length > 0) {
        setInCache(cacheKey, fallbackSearch.items, 900);
        return fallbackSearch.items;
      }
    } catch {}

    // Fallback 2: Asura Scans popular manhwas
    const asuraItems = await getAsuraPopularSeries(limit);
    if (asuraItems.length > 0) {
      setInCache(cacheKey, asuraItems, 900);
      return asuraItems;
    }

    return [];
  });
}

/**
 * Fetches real-time Trending Korean Manhwas from WeebCentral with Asura fallback.
 */
export async function getPopularManhwa(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_manhwa_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  return dedupeRequest(cacheKey, async () => {
    try {
      const res = await fetchWithTimeout(
        `${WEEBCENTRAL_BASE}/search/data?included_type=Manhwa&sort=Popularity&order=Descending&official=Any&anime=Any&adult=False&limit=${limit}`,
        {
          headers: {
            "HX-Request": "true",
          },
          next: { revalidate: 900 },
        } as any,
        5000
      );

      if (res.ok) {
        const html = await res.text();
        const items = parseWeebCentralHtml(html);
        if (items.length > 0) {
          const result = items.slice(0, limit);
          setInCache(cacheKey, result, 900);
          return result;
        }
      }
    } catch (err) {
      console.warn("[MangaFetch] WeebCentral getPopularManhwa failed:", err);
    }

    // Fallback 1: Asura Scans dedicated series API
    const asuraItems = await getAsuraPopularSeries(limit);
    if (asuraItems.length > 0) {
      setInCache(cacheKey, asuraItems, 900);
      return asuraItems;
    }

    // Fallback 2: searchManga for manhwa
    try {
      const fallbackSearch = await searchManga("", { type: "manhwa", limit, sortBy: "rating" });
      if (fallbackSearch.items && fallbackSearch.items.length > 0) {
        setInCache(cacheKey, fallbackSearch.items, 900);
        return fallbackSearch.items;
      }
    } catch {}

    return [];
  });
}

/**
 * Fetches real-time Trending Japanese Mangas from WeebCentral with search fallback.
 */
export async function getLatestMangaUpdates(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_latest_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  return dedupeRequest(cacheKey, async () => {
    try {
      const res = await fetchWithTimeout(
        `${WEEBCENTRAL_BASE}/search/data?included_type=Manga&sort=Latest%20Updates&order=Descending&official=Any&anime=Any&adult=False&limit=${limit}`,
        {
          headers: {
            "HX-Request": "true",
          },
          next: { revalidate: 900 },
        } as any,
        5000
      );

      if (res.ok) {
        const html = await res.text();
        const items = parseWeebCentralHtml(html);
        if (items.length > 0) {
          const result = items.slice(0, limit);
          setInCache(cacheKey, result, 900);
          return result;
        }
      }
    } catch (err) {
      console.warn("[MangaFetch] WeebCentral getLatestMangaUpdates failed:", err);
    }

    // Fallback: searchManga for manga
    try {
      const fallbackSearch = await searchManga("", { type: "manga", limit, sortBy: "latestUploadedChapter" });
      if (fallbackSearch.items && fallbackSearch.items.length > 0) {
        setInCache(cacheKey, fallbackSearch.items, 900);
        return fallbackSearch.items;
      }
    } catch {}

    return [];
  });
}

/**
 * Searches Asura Scans as secondary fallback.
 */
async function searchAsura(query: string): Promise<MangaItem[]> {
  if (!query?.trim()) return [];
  try {
    const res = await fetchWithTimeout(`${ASURA_API}/search?q=${encodeURIComponent(query.trim())}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 1800 },
    } as any, 5000);
    if (!res.ok) return [];
    const data = await res.json();
    const seriesList = data.data || [];

    return seriesList.map((s: any) => ({
      id: `asura-${s.slug}`,
      title: decodeHtmlEntities(s.title || s.slug),
      altTitles: s.alt_titles || [],
      description: decodeHtmlEntities((s.description || "").replace(/<[^>]+>/g, "").trim()) || `Read ${s.title} on CineStream.`,
      coverImage: s.cover_url || s.thumbnail_url || "/icon-512.png",
      bannerImage: s.cover_url || s.thumbnail_url || "/icon-512.png",
      type: "manhwa" as const,
      status: (s.status?.toLowerCase() === "completed" ? "completed" : "ongoing") as any,
      releaseYear: s.release_year || null,
      tags: ["Action", "Manhwa", "Fantasy"],
      contentRating: "safe" as const,
      originalLanguage: "ko",
      source: "asura" as const,
    }));
  } catch (err) {
    console.warn("[MangaFetch] Asura search fallback failed:", err);
    return [];
  }
}

/**
 * Searches or filters Manga / Manhwa with balanced combination and pagination.
 */
export async function searchManga(
  query: string,
  options?: {
    type?: "all" | "manga" | "manhwa" | "manhua";
    limit?: number;
    offset?: number;
    sortBy?: "followedCount" | "relevance" | "latestUploadedChapter" | "rating" | "latest";
    genreId?: string;
    genreName?: string;
  }
): Promise<{ items: MangaItem[]; total: number }> {
  const limit = options?.limit || 24;
  const offset = options?.offset || 0;
  const genreName = options?.genreName || "";
  const type = options?.type || "all";
  const sortBy = options?.sortBy || "followedCount";

  const cacheKey = `search_${query}_${type}_${limit}_${offset}_${sortBy}_${genreName}`;
  const cached = getFromCache<{ items: MangaItem[]; total: number }>(cacheKey);
  if (cached && cached.items && cached.items.length > 0) return cached;

  return dedupeRequest(cacheKey, async () => {
    try {
      const tagParam = genreName ? `&included_tag=${encodeURIComponent(genreName)}` : "";
      const textParam = query?.trim() ? `&text=${encodeURIComponent(query.trim())}` : "";

      let sortParam = "&sort=Subscribers&order=Descending";
      if (sortBy === "latestUploadedChapter" || sortBy === "latest") {
        sortParam = "&sort=Latest%20Update&order=Descending";
      } else if (sortBy === "rating" || sortBy === "relevance") {
        sortParam = "&sort=Popularity&order=Descending";
      }

      // 1. Text Search Mode: Query directly for the keyword
      if (query?.trim()) {
        const typeParam =
          type === "manhwa"
            ? "&included_type=Manhwa"
            : type === "manga"
            ? "&included_type=Manga"
            : "";

        const res = await fetchWithTimeout(
          `${WEEBCENTRAL_BASE}/search/data?official=Any&anime=Any&adult=False${sortParam}${typeParam}${tagParam}${textParam}&offset=${offset}&limit=${limit}`,
          {
            headers: {
              "HX-Request": "true",
            },
            cache: "no-store",
          },
          6000
        );

        if (res.ok) {
          const html = await res.text();
          const items = parseWeebCentralHtml(html);
          if (items.length > 0) {
            const result = { items: items.slice(0, limit), total: 500 };
            setInCache(cacheKey, result, 1200);
            return result;
          }
        }

        // Secondary fallback to Asura Scans search if 0 results
        const asuraResults = await searchAsura(query.trim());
        if (asuraResults.length > 0) {
          const result = { items: asuraResults.slice(0, limit), total: asuraResults.length };
          setInCache(cacheKey, result, 1200);
          return result;
        }
      } else if (type === "all") {
        // 2. Browse Mode (no search text, type=all): Equal 50/50 balanced combination
        const halfLimit = Math.max(12, Math.ceil(limit / 2));
        const halfOffset = Math.floor(offset / 2);

        const [manhwaRes, mangaRes] = await Promise.all([
          fetchWithTimeout(
            `${WEEBCENTRAL_BASE}/search/data?included_type=Manhwa${tagParam}${sortParam}&adult=False&offset=${halfOffset}&limit=${halfLimit}`,
            {
              headers: {
                "HX-Request": "true",
              },
              cache: "no-store",
            },
            5000
          ).catch(() => null),
          fetchWithTimeout(
            `${WEEBCENTRAL_BASE}/search/data?included_type=Manga${tagParam}${sortParam}&adult=False&offset=${halfOffset}&limit=${halfLimit}`,
            {
              headers: {
                "HX-Request": "true",
              },
              cache: "no-store",
            },
            5000
          ).catch(() => null),
        ]);

        let manhwaItems: MangaItem[] = [];
        let mangaItems: MangaItem[] = [];

        if (manhwaRes && manhwaRes.ok) {
          const html = await manhwaRes.text();
          manhwaItems = parseWeebCentralHtml(html);
        }
        if (mangaRes && mangaRes.ok) {
          const html = await mangaRes.text();
          mangaItems = parseWeebCentralHtml(html);
        }

        // Interleave equally (Manhwa, Manga, Manhwa, Manga...)
        const combined: MangaItem[] = [];
        const maxLen = Math.max(manhwaItems.length, mangaItems.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < manhwaItems.length) combined.push(manhwaItems[i]);
          if (i < mangaItems.length) combined.push(mangaItems[i]);
        }

        if (combined.length > 0) {
          const result = { items: combined.slice(0, limit), total: 500 };
          setInCache(cacheKey, result, 1200);
          return result;
        }
      } else {
        // 3. Browse Mode with specific type filter (Manga or Manhwa)
        const typeParam =
          type === "manhwa"
            ? "&included_type=Manhwa"
            : type === "manga"
            ? "&included_type=Manga"
            : "";

        const res = await fetchWithTimeout(
          `${WEEBCENTRAL_BASE}/search/data?official=Any&anime=Any&adult=False${sortParam}${typeParam}${tagParam}&offset=${offset}&limit=${limit}`,
          {
            headers: {
              "HX-Request": "true",
            },
            cache: "no-store",
          },
          6000
        );

        if (res.ok) {
          const html = await res.text();
          const items = parseWeebCentralHtml(html);
          if (items.length > 0) {
            const result = { items: items.slice(0, limit), total: 500 };
            setInCache(cacheKey, result, 1200);
            return result;
          }
        }
      }
    } catch (err) {
      console.warn("[MangaFetch] WeebCentral search failed:", err);
    }

    return { items: [], total: 0 };
  });
}

/**
 * Fetches full details for a Manga/Manhwa from WeebCentral or Asura Scans.
 */
export async function getMangaDetails(id: string): Promise<MangaItem | null> {
  const cacheKey = `details_${id}`;
  const cached = getFromCache<MangaItem>(cacheKey);
  if (cached) return cached;

  return dedupeRequest(cacheKey, async () => {
    // Asura Scans details
    if (id.startsWith("asura-")) {
      const slug = id.replace(/^asura-/, "");
      try {
        const res = await fetchWithTimeout(`${ASURA_API}/series/${slug}`, {
          next: { revalidate: 1800 },
        } as any, 5000);
        if (res.ok) {
          const data = await res.json();
          const s = data.series || data.data || data;
          const item: MangaItem = {
            id: `asura-${slug}`,
            title: decodeHtmlEntities(s.title || slug),
            altTitles: s.alt_titles || [],
            description: decodeHtmlEntities((s.description || "").replace(/<[^>]+>/g, "").trim()) || `Read ${s.title || slug} on CineStream.`,
            coverImage: s.cover_url || s.thumbnail_url || "/icon-512.png",
            bannerImage: s.cover_url || s.thumbnail_url || "/icon-512.png",
            type: "manhwa",
            status: (s.status?.toLowerCase() === "completed" ? "completed" : "ongoing") as any,
            releaseYear: s.release_year || null,
            tags: (s.genres || ["Action", "Manhwa", "Fantasy"]).map((g: any) => typeof g === "string" ? g : g.name || "Action"),
            contentRating: "safe",
            originalLanguage: "ko",
            source: "asura",
          };
          setInCache(cacheKey, item, 1800);
          return item;
        }
      } catch (err) {
        console.warn(`[MangaFetch] Asura getMangaDetails failed for ${id}:`, err);
      }
      return null;
    }

    // WeebCentral details
    const rawId = id.replace(/^wc-/, "");
    try {
      const res = await fetchWithTimeout(`${WEEBCENTRAL_BASE}/series/${rawId}`, {
        next: { revalidate: 1800 },
      } as any, 6000);
      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([^<|]+)/i);
        const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Manga";
        const title = decodeHtmlEntities(rawTitle);
        const descMatch =
          html.match(/<strong>Description<\/strong>\s*<p[^>]*>([\s\S]*?)<\/p>/i) ||
          html.match(/<p class="[^"]*whitespace-pre-wrap[^"]*">([\s\S]*?)<\/p>/i) ||
          html.match(/<p class="[^"]*leading-relaxed[^"]*">([\s\S]*?)<\/p>/i);
        const rawDescription = descMatch && descMatch[1]
          ? descMatch[1].replace(/<[^>]+>/g, "").trim()
          : `Read ${title} on CineStream.`;
        const description = decodeHtmlEntities(rawDescription);
        const coverMatch = html.match(/https:\/\/temp\.compsci88\.com\/cover\/[^\s"']+/i);
        const coverImage = coverMatch ? coverMatch[0] : "/icon-512.png";

        const yearMatch = html.match(/<strong>Year:<\/strong>\s*<span>(\d+)<\/span>/i);
        const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

        const statusMatch = html.match(/<strong>Status:<\/strong>\s*<span>([^<]+)<\/span>/i);
        const status = (statusMatch ? statusMatch[1].trim().toLowerCase() : "ongoing") as any;

        const typeMatch = html.match(/<strong>Type:<\/strong>\s*<span>([^<]+)<\/span>/i);
        const rawType = typeMatch ? typeMatch[1].trim().toLowerCase() : "manga";
        let type: "manga" | "manhwa" | "manhua" = "manga";
        if (rawType.includes("manhwa")) type = "manhwa";
        else if (rawType.includes("manhua")) type = "manhua";

        const tagsMatch = html.match(/<strong>Tag\(s\):<\/strong>([\s\S]*?)<\/div>/i);
        const tags = tagsMatch
          ? [...tagsMatch[1].matchAll(/<span>([^<,]+),?<\/span>/g)].map((m) => decodeHtmlEntities(m[1].trim()))
          : ["Action", "Webtoon"];

        const item: MangaItem = {
          id: `wc-${rawId}`,
          title,
          description,
          coverImage,
          bannerImage: coverImage,
          type,
          status,
          releaseYear,
          tags,
          contentRating: "safe",
          originalLanguage: "en",
          source: "weebcentral",
        };

        setInCache(cacheKey, item, 1800);
        return item;
      }
    } catch (err) {
      console.warn(`[MangaFetch] WeebCentral getMangaDetails failed for ${id}:`, err);
    }

    return null;
  });
}

/**
 * Helper to fetch WeebCentral chapters.
 */
async function fetchWeebCentralChapters(seriesId: string): Promise<MangaChapter[]> {
  const rawId = seriesId.replace(/^wc-/, "");
  const cacheKey = `chapters_wc_${rawId}`;
  const cached = getFromCache<MangaChapter[]>(cacheKey);
  if (cached) return cached;

  return dedupeRequest(cacheKey, async () => {
    try {
      const res = await fetchWithTimeout(`${WEEBCENTRAL_BASE}/series/${rawId}/full-chapter-list`, {
        headers: {
          "HX-Request": "true",
        },
        next: { revalidate: 900 },
      } as any, 6000);
      if (!res.ok) return [];
      const html = await res.text();

      const items = html.split('<a href="/chapters/');
      const chapters: MangaChapter[] = [];

      for (const block of items.slice(1)) {
        const idMatch = block.match(/^([^"]+)"/);
        if (!idMatch) continue;
        const chId = `wc-${idMatch[1]}`;

        const titleMatch = block.match(/<span class="">([^<]+)<\/span>/);
        const name = titleMatch ? titleMatch[1].trim() : "Chapter";
        const numMatch = name.match(/(\d+(\.\d+)?)/);
        const chNum = numMatch ? numMatch[1] : "0";

        // Extract real actual publication datetime from <time datetime="...">
        const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"[^>]*>/i);
        const publishAt = timeMatch && timeMatch[1] ? timeMatch[1].trim() : "";

        chapters.push({
          id: chId,
          chapterNumber: chNum,
          title: name,
          language: "en",
          pagesCount: 1,
          publishAt,
          scanlationGroup: "WeebCentral",
          source: "weebcentral",
        });
      }

      setInCache(cacheKey, chapters, 900);
      return chapters;
    } catch (err) {
      console.warn("[MangaFetch] fetchWeebCentralChapters failed:", err);
      return [];
    }
  });
}

/**
 * Helper to fetch Asura Scans chapters.
 */
async function fetchAsuraChapters(seriesSlug: string): Promise<MangaChapter[]> {
  const cacheKey = `chapters_asura_${seriesSlug}`;
  const cached = getFromCache<MangaChapter[]>(cacheKey);
  if (cached) return cached;

  return dedupeRequest(cacheKey, async () => {
    try {
      const res = await fetchWithTimeout(`${ASURA_API}/series/${seriesSlug}/chapters`, {
        next: { revalidate: 900 },
      } as any, 5000);
      if (!res.ok) return [];
      const data = await res.json();
      const list = data.data || [];

      const chapters: MangaChapter[] = list.map((c: any) => ({
        id: `asura-${seriesSlug}---${c.slug || `chapter-${c.number}`}`,
        chapterNumber: String(c.number || 0),
        title: `Chapter ${c.number || 0}`,
        language: "en",
        pagesCount: c.page_count || 1,
        publishAt: c.published_at || c.created_at || "",
        scanlationGroup: "Asura Scans",
        source: "asura" as const,
      }));

      setInCache(cacheKey, chapters, 900);
      return chapters;
    } catch (err) {
      console.warn(`[MangaFetch] fetchAsuraChapters failed for ${seriesSlug}:`, err);
      return [];
    }
  });
}

/**
 * Fetches chapters for Manga/Manhwa from WeebCentral or Asura Scans.
 */
export async function getMangaChapters(
  id: string,
  _options?: {
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }
): Promise<{ chapters: MangaChapter[]; total: number }> {
  if (id.startsWith("asura-")) {
    const slug = id.replace(/^asura-/, "");
    const chapters = await fetchAsuraChapters(slug);
    return { chapters, total: chapters.length };
  }

  const chapters = await fetchWeebCentralChapters(id);
  return { chapters, total: chapters.length };
}

/**
 * Fetches high-res page URLs for a chapter from WeebCentral or Asura Scans.
 */
export async function getChapterPages(
  chapterId: string,
  mangaTitle?: string,
  chapterNumber?: string
): Promise<ChapterPagesData | null> {
  // 1. Asura chapter pages
  if (chapterId.startsWith("asura-")) {
    const parts = chapterId.replace(/^asura-/, "").split("---");
    const seriesSlug = parts[0];
    const chapterSlug = parts[1];

    try {
      const res = await fetchWithTimeout(`${ASURA_API}/series/${seriesSlug}/chapters/${chapterSlug}`, {
        cache: "no-store",
      }, 5000);
      if (!res.ok) return null;
      const data = await res.json();
      const pages = data.data?.chapter?.pages || [];
      const imgUrls = pages.map((p: any) => p.url).filter(Boolean);

      if (imgUrls.length === 0) return null;

      return {
        chapterId,
        chapterNumber: "",
        mangaId: `asura-${seriesSlug}`,
        pageUrls: imgUrls,
        dataSaverUrls: imgUrls,
      };
    } catch (err) {
      console.warn(`[MangaFetch] Asura getChapterPages failed for ${chapterId}:`, err);
      return null;
    }
  }

  // 2. WeebCentral chapter pages
  const rawId = chapterId.replace(/^wc-/, "");
  try {
    let res = await fetchWithTimeout(`${WEEBCENTRAL_BASE}/chapters/${rawId}/images?reading_style=long_strip`, {
      headers: {
        "HX-Request": "true",
      },
      cache: "no-store",
    }, 6000);

    if (!res.ok) {
      res = await fetchWithTimeout(`${WEEBCENTRAL_BASE}/chapters/${rawId}`, {
        cache: "no-store",
      }, 6000);
    }

    if (res.ok) {
      const html = await res.text();

      const imgMatches = [
        ...html.matchAll(/<img[^>]+(?:src|data-src)="([^"]+)"/g),
        ...html.matchAll(/https:\/\/(?:temp\.compsci88\.com|scans-hot\.planeptune\.us|cdn\.[^"'\s]+)\/manga\/[^"'\s]+/g)
      ];

      const imgUrls: string[] = [];
      const seen = new Set<string>();

      for (const m of imgMatches) {
        const url = typeof m === "string" ? m : m[1] || m[0];
        if (
          url &&
          url.startsWith("http") &&
          !url.includes("broken_image") &&
          !url.includes("badge") &&
          !url.includes("avatar") &&
          !url.includes("icon") &&
          !url.includes("logo") &&
          !seen.has(url)
        ) {
          seen.add(url);
          imgUrls.push(url);
        }
      }

      if (imgUrls.length > 0) {
        return {
          chapterId: `wc-${rawId}`,
          chapterNumber: "",
          mangaId: "",
          pageUrls: imgUrls,
          dataSaverUrls: imgUrls,
        };
      }
    }
  } catch (err) {
    console.warn(`[MangaFetch] WeebCentral getChapterPages failed for ${chapterId}:`, err);
  }

  // 3. Fallback: Check Asura Scans if title or chapterNumber is provided
  if (mangaTitle && chapterNumber) {
    try {
      const asuraResults = await searchAsura(mangaTitle);
      if (asuraResults.length > 0) {
        const asuraSlug = asuraResults[0].id.replace(/^asura-/, "");
        const asuraChapters = await fetchAsuraChapters(asuraSlug);
        const matchCh = asuraChapters.find(
          (c) => c.chapterNumber === chapterNumber || parseFloat(c.chapterNumber) === parseFloat(chapterNumber)
        );
        if (matchCh) {
          const asuraPages = await getChapterPages(matchCh.id);
          if (asuraPages && asuraPages.pageUrls.length > 0) {
            return asuraPages;
          }
        }
      }
    } catch (e) {
      console.warn("[MangaFetch] Asura chapter fallback failed:", e);
    }
  }

  return null;
}
