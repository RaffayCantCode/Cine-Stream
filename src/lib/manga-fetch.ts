/**
 * Manga and Manhwa Fetching Engine
 * Primary Source: WeebCentral API/Engine (https://weebcentral.com)
 * Secondary Source: MangaDex API (https://api.mangadex.org)
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
  source?: "weebcentral" | "mangadex";
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
  source?: "weebcentral" | "mangadex";
}

export interface ChapterPagesData {
  chapterId: string;
  chapterNumber: string;
  mangaId: string;
  pageUrls: string[];
  dataSaverUrls: string[];
}

const WEEBCENTRAL_BASE = "https://weebcentral.com";
const MANGADEX_API = "https://api.mangadex.org";
const MANGADEX_COVER_BASE = "https://uploads.mangadex.org/covers";

// High-speed in-memory response cache
const serverCache = new Map<string, { data: any; expiry: number }>();

function getFromCache<T>(key: string): T | null {
  const item = serverCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    serverCache.delete(key);
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
  serverCache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

/**
 * Parses WeebCentral search / list HTML into standardized MangaItem array.
 */
function parseWeebCentralHtml(html: string): MangaItem[] {
  const articles = html.split('<article class="bg-base-300 flex gap-4 p-4">');
  const items: MangaItem[] = [];
  const seen = new Set<string>();

  for (const block of articles.slice(1)) {
    const linkMatch = block.match(/href="https:\/\/weebcentral\.com\/series\/([^/]+)\/([^"]+)"/);
    if (!linkMatch) continue;

    const id = `wc-${linkMatch[1]}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const slug = linkMatch[2];

    const titleMatch =
      block.match(/class="line-clamp-1 link link-hover">([^<]+)<\/a>/) ||
      block.match(/alt="([^"]+)\s+cover"/);
    const title = titleMatch ? titleMatch[1].trim() : decodeURIComponent(slug.replace(/-/g, " "));

    const coverMatch = block.match(/https:\/\/temp\.compsci88\.com\/cover\/[^\s"']+/);
    const coverImage = coverMatch ? coverMatch[0] : "/icon-512.png";

    const yearMatch = block.match(/<strong>Year:<\/strong>\s*<span>(\d+)<\/span>/i);
    const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

    const statusMatch = block.match(/<strong>Status:<\/strong>\s*<span>([^<]+)<\/span>/i);
    const status = (statusMatch ? statusMatch[1].trim().toLowerCase() : "ongoing") as any;

    const typeMatch = block.match(/<strong>Type:<\/strong>\s*<span>([^<]+)<\/span>/i);
    const rawType = typeMatch ? typeMatch[1].trim().toLowerCase() : "manga";
    let type: "manga" | "manhwa" | "manhua" = "manga";
    if (rawType.includes("manhwa") || slug.toLowerCase().includes("manhwa")) type = "manhwa";
    else if (rawType.includes("manhua")) type = "manhua";

    const tagsMatch = block.match(/<strong>Tag\(s\):<\/strong>([\s\S]*?)<\/div>/i);
    const tags = tagsMatch
      ? [...tagsMatch[1].matchAll(/<span>([^<,]+),?<\/span>/g)].map((m) => m[1].trim())
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
 * Dynamically extracts the English title from MangaDex attributes.
 */
function extractBestEnglishTitle(attrs: any): string {
  const titles = attrs.title || {};

  if (titles.en && typeof titles.en === "string" && titles.en.trim().length > 0) {
    return titles.en.trim();
  }
  if (titles["en-us"] && typeof titles["en-us"] === "string" && titles["en-us"].trim().length > 0) {
    return titles["en-us"].trim();
  }

  const altTitlesList = attrs.altTitles || [];
  for (const alt of altTitlesList) {
    if (typeof alt === "object" && alt !== null) {
      if (alt.en && typeof alt.en === "string" && alt.en.trim().length > 0) {
        return alt.en.trim();
      }
      if (alt["en-us"] && typeof alt["en-us"] === "string" && alt["en-us"].trim().length > 0) {
        return alt["en-us"].trim();
      }
    }
  }

  return (
    titles["ja-ro"] ||
    titles["ko-ro"] ||
    titles["zh-ro"] ||
    Object.values(titles)[0] ||
    "Untitled"
  ).toString();
}

/**
 * Formats MangaDex item to MangaItem.
 */
export function formatMangaDexItem(item: any): MangaItem {
  const attrs = item.attributes || {};
  const relationships = item.relationships || [];

  const title = extractBestEnglishTitle(attrs);

  const altTitles: string[] = (attrs.altTitles || [])
    .flatMap((t: any) => Object.values(t))
    .filter((t: any): t is string => typeof t === "string");

  const descs = attrs.description || {};
  const description =
    descs.en ||
    descs["en-us"] ||
    Object.values(descs)[0] ||
    `Read ${title} on CineStream.`;

  const coverRel = relationships.find((r: any) => r.type === "cover_art");
  const coverFileName = coverRel?.attributes?.fileName;
  const coverImage = coverFileName
    ? `${MANGADEX_COVER_BASE}/${item.id}/${coverFileName}.512.jpg`
    : "/icon-512.png";

  const authors = relationships
    .filter((r: any) => r.type === "author")
    .map((r: any) => r.attributes?.name)
    .filter(Boolean);

  const artists = relationships
    .filter((r: any) => r.type === "artist")
    .map((r: any) => r.attributes?.name)
    .filter(Boolean);

  const origLang = (attrs.originalLanguage || "ja").toLowerCase();
  let type: "manga" | "manhwa" | "manhua" = "manga";
  if (origLang === "ko") type = "manhwa";
  else if (origLang === "zh" || origLang === "zh-hk") type = "manhua";

  const tags = (attrs.tags || [])
    .map((tag: any) => tag.attributes?.name?.en)
    .filter(Boolean);

  return {
    id: item.id,
    title,
    altTitles,
    description,
    coverImage,
    bannerImage: coverImage,
    type,
    status: attrs.status || "ongoing",
    releaseYear: attrs.year || null,
    authors: authors.length > 0 ? authors : undefined,
    artists: artists.length > 0 ? artists : undefined,
    tags,
    contentRating: attrs.contentRating || "safe",
    originalLanguage: origLang,
    lastChapter: attrs.lastChapter || null,
    followedCount: attrs.followedCount,
    source: "mangadex",
  };
}

/**
 * Fetches real-time Trending Now (combined Manga + Manhwa) from WeebCentral (with MangaDex fallback).
 */
export async function getMangaTrending(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_trending_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${WEEBCENTRAL_BASE}/search/data?sort=Subscribers&order=Descending&official=Any&anime=Any&adult=False`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "HX-Request": "true",
        },
        next: { revalidate: 1800 },
      }
    );

    if (res.ok) {
      const html = await res.text();
      const items = parseWeebCentralHtml(html);
      if (items.length > 0) {
        const result = items.slice(0, limit);
        setInCache(cacheKey, result, 1800);
        return result;
      }
    }
  } catch (err) {
    console.warn("[MangaFetch] WeebCentral getMangaTrending failed, trying MangaDex fallback:", err);
  }

  // MangaDex Fallback
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      "order[followedCount]": "desc",
      "contentRating[]": "safe",
    });
    params.append("contentRating[]", "suggestive");
    params.append("includes[]", "cover_art");
    params.append("includes[]", "author");

    const res = await fetch(`${MANGADEX_API}/manga?${params.toString()}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const result = (data.data || []).map(formatMangaDexItem);
    setInCache(cacheKey, result, 1800);
    return result;
  } catch (err) {
    console.warn("[MangaFetch] MangaDex getMangaTrending fallback failed:", err);
    return [];
  }
}

/**
 * Fetches real-time Trending Korean Manhwas from WeebCentral (with MangaDex fallback).
 */
export async function getPopularManhwa(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_manhwa_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${WEEBCENTRAL_BASE}/search/data?included_type=Manhwa&sort=Subscribers&order=Descending&official=Any&anime=Any&adult=False`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "HX-Request": "true",
        },
        next: { revalidate: 1800 },
      }
    );

    if (res.ok) {
      const html = await res.text();
      const items = parseWeebCentralHtml(html);
      if (items.length > 0) {
        const result = items.slice(0, limit);
        setInCache(cacheKey, result, 1800);
        return result;
      }
    }
  } catch (err) {
    console.warn("[MangaFetch] WeebCentral getPopularManhwa failed, trying MangaDex fallback:", err);
  }

  // MangaDex Fallback
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      "originalLanguage[]": "ko",
      "order[followedCount]": "desc",
      "contentRating[]": "safe",
    });
    params.append("contentRating[]", "suggestive");
    params.append("includes[]", "cover_art");
    params.append("includes[]", "author");

    const res = await fetch(`${MANGADEX_API}/manga?${params.toString()}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const result = (data.data || []).map(formatMangaDexItem);
    setInCache(cacheKey, result, 1800);
    return result;
  } catch (err) {
    console.warn("[MangaFetch] MangaDex getPopularManhwa fallback failed:", err);
    return [];
  }
}

/**
 * Fetches real-time Trending Japanese Mangas from WeebCentral (with MangaDex fallback).
 */
export async function getLatestMangaUpdates(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_latest_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${WEEBCENTRAL_BASE}/search/data?included_type=Manga&sort=Subscribers&order=Descending&official=Any&anime=Any&adult=False`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "HX-Request": "true",
        },
        next: { revalidate: 1800 },
      }
    );

    if (res.ok) {
      const html = await res.text();
      const items = parseWeebCentralHtml(html);
      if (items.length > 0) {
        const result = items.slice(0, limit);
        setInCache(cacheKey, result, 1800);
        return result;
      }
    }
  } catch (err) {
    console.warn("[MangaFetch] WeebCentral getLatestMangaUpdates failed, trying MangaDex fallback:", err);
  }

  // MangaDex Fallback
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      "originalLanguage[]": "ja",
      "order[followedCount]": "desc",
      "contentRating[]": "safe",
    });
    params.append("contentRating[]", "suggestive");
    params.append("includes[]", "cover_art");
    params.append("includes[]", "author");

    const res = await fetch(`${MANGADEX_API}/manga?${params.toString()}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const result = (data.data || []).map(formatMangaDexItem);
    setInCache(cacheKey, result, 1800);
    return result;
  } catch (err) {
    console.warn("[MangaFetch] MangaDex getLatestMangaUpdates fallback failed:", err);
    return [];
  }
}

/**
 * Searches or filters Manga / Manhwa with balanced Manga+Manhwa combination and pagination.
 */
export async function searchManga(
  query: string,
  options?: {
    type?: "all" | "manga" | "manhwa" | "manhua";
    limit?: number;
    offset?: number;
    sortBy?: "followedCount" | "relevance" | "latestUploadedChapter" | "rating";
    genreId?: string;
    genreName?: string;
  }
): Promise<{ items: MangaItem[]; total: number }> {
  const limit = options?.limit || 24;
  const offset = options?.offset || 0;
  const genreName = options?.genreName || "";
  const type = options?.type || "all";
  const sortBy = options?.sortBy || "followedCount";

  const cacheKey = `search_${query}_${type}_${limit}_${offset}_${sortBy}_${genreName}_${options?.genreId || ""}`;
  const cached = getFromCache<{ items: MangaItem[]; total: number }>(cacheKey);
  if (cached) return cached;

  // 1. If searching via WeebCentral (keyword or genre)
  if (query?.trim() || genreName) {
    try {
      const tagParam = genreName ? `&included_tag=${encodeURIComponent(genreName)}` : "";
      const textParam = query?.trim() ? `&text=${encodeURIComponent(query.trim())}` : "";

      if (type === "all") {
        // Equal 50/50 balanced combination of Manga and Manhwa
        const halfLimit = Math.max(12, Math.ceil(limit / 2));
        const halfOffset = Math.floor(offset / 2);

        const [manhwaRes, mangaRes] = await Promise.all([
          fetch(
            `${WEEBCENTRAL_BASE}/search/data?included_type=Manhwa${tagParam}${textParam}&sort=Subscribers&order=Descending&adult=False&offset=${halfOffset}&limit=${halfLimit}`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "HX-Request": "true",
              },
              cache: "no-store",
            }
          ).catch(() => null),
          fetch(
            `${WEEBCENTRAL_BASE}/search/data?included_type=Manga${tagParam}${textParam}&sort=Subscribers&order=Descending&adult=False&offset=${halfOffset}&limit=${halfLimit}`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "HX-Request": "true",
              },
              cache: "no-store",
            }
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
        const typeParam =
          type === "manhwa"
            ? "&included_type=Manhwa"
            : type === "manga"
            ? "&included_type=Manga"
            : "";

        const res = await fetch(
          `${WEEBCENTRAL_BASE}/search/data?sort=Subscribers&order=Descending${typeParam}${tagParam}${textParam}&adult=False&offset=${offset}&limit=${limit}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "HX-Request": "true",
            },
            cache: "no-store",
          }
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
      console.warn("[MangaFetch] WeebCentral search failed, trying MangaDex fallback:", err);
    }
  }

  // MangaDex Fallback
  try {
    const mdSortBy = options?.sortBy || (query ? "relevance" : "followedCount");

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      "contentRating[]": "safe",
    });
    params.append("contentRating[]", "suggestive");
    params.append("includes[]", "cover_art");
    params.append("includes[]", "author");

    if (query?.trim()) {
      params.append("title", query.trim());
    }

    if (options?.type && options.type !== "all") {
      if (options.type === "manga") params.append("originalLanguage[]", "ja");
      else if (options.type === "manhwa") params.append("originalLanguage[]", "ko");
      else if (options.type === "manhua") params.append("originalLanguage[]", "zh");
    }

    if (options?.genreId) {
      params.append("includedTags[]", options.genreId);
    }

    params.append(`order[${mdSortBy}]`, "desc");

    const res = await fetch(`${MANGADEX_API}/manga?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return { items: [], total: 0 };
    const data = await res.json();
    const result = {
      items: (data.data || []).map(formatMangaDexItem),
      total: data.total || 0,
    };
    setInCache(cacheKey, result, 1200);
    return result;
  } catch (err) {
    console.warn("[MangaFetch] searchManga fallback failed:", err);
    return { items: [], total: 0 };
  }
}

/**
 * Fetches details for a single Manga or Manhwa.
 */
export async function getMangaDetails(id: string): Promise<MangaItem | null> {
  // If WeebCentral ID
  if (id.startsWith("wc-")) {
    const rawId = id.replace(/^wc-/, "");
    try {
      const res = await fetch(`${WEEBCENTRAL_BASE}/series/${rawId}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        next: { revalidate: 1800 },
      });
      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([^<|]+)/i);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Manga";
        const descMatch =
          html.match(/<strong>Description<\/strong>\s*<p[^>]*>([\s\S]*?)<\/p>/i) ||
          html.match(/<p class="[^"]*whitespace-pre-wrap[^"]*">([\s\S]*?)<\/p>/i) ||
          html.match(/<p class="[^"]*leading-relaxed[^"]*">([\s\S]*?)<\/p>/i);
        const description = descMatch && descMatch[1]
          ? descMatch[1].replace(/<[^>]+>/g, "").trim()
          : `Read ${title} on CineStream.`;
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
          ? [...tagsMatch[1].matchAll(/<span>([^<,]+),?<\/span>/g)].map((m) => m[1].trim())
          : ["Action", "Webtoon"];

        return {
          id,
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
      }
    } catch (err) {
      console.warn(`[MangaFetch] WeebCentral getMangaDetails failed for ${id}:`, err);
    }
  }

  // MangaDex Details
  try {
    const params = new URLSearchParams({
      "includes[]": "cover_art",
    });
    params.append("includes[]", "author");
    params.append("includes[]", "artist");

    const res = await fetch(`${MANGADEX_API}/manga/${id}?${params.toString()}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.data) return null;
    return formatMangaDexItem(data.data);
  } catch (err) {
    console.warn(`[MangaFetch] getMangaDetails failed for ${id}:`, err);
    return null;
  }
}

/**
 * Helper to fetch WeebCentral chapters.
 */
async function fetchWeebCentralChapters(seriesId: string): Promise<MangaChapter[]> {
  const rawId = seriesId.replace(/^wc-/, "");
  const cacheKey = `chapters_wc_${rawId}`;
  const cached = getFromCache<MangaChapter[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${WEEBCENTRAL_BASE}/series/${rawId}/full-chapter-list`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "HX-Request": "true",
      },
      next: { revalidate: 900 },
    });
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
}

/**
 * Fetches chapters for Manga, with WeebCentral as primary source and MangaDex as fallback.
 */
export async function getMangaChapters(
  id: string,
  options?: {
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }
): Promise<{ chapters: MangaChapter[]; total: number }> {
  // 1. If WeebCentral series ID
  if (id.startsWith("wc-")) {
    const chapters = await fetchWeebCentralChapters(id);
    return { chapters, total: chapters.length };
  }

  // 2. If MangaDex ID, try WeebCentral first using title search for highest completeness
  const details = await getMangaDetails(id);
  if (details?.title) {
    try {
      const wcSearchRes = await fetch(
        `${WEEBCENTRAL_BASE}/search/data?text=${encodeURIComponent(details.title)}&adult=False`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "HX-Request": "true",
          },
          next: { revalidate: 1800 },
        }
      );
      if (wcSearchRes.ok) {
        const wcHtml = await wcSearchRes.text();
        const wcItems = parseWeebCentralHtml(wcHtml);
        if (wcItems.length > 0) {
          const wcChapters = await fetchWeebCentralChapters(wcItems[0].id);
          if (wcChapters.length > 0) {
            return { chapters: wcChapters, total: wcChapters.length };
          }
        }
      }
    } catch (err) {
      console.warn(`[MangaFetch] WeebCentral chapter lookup failed for ${details.title}:`, err);
    }
  }

  // 3. MangaDex fallback
  try {
    const order = options?.order || "asc";
    const limit = options?.limit || 500;
    const offset = options?.offset || 0;

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      "translatedLanguage[]": "en",
      "order[chapter]": order,
      "contentRating[]": "safe",
    });
    params.append("contentRating[]", "suggestive");
    params.append("includes[]", "scanlation_group");

    const res = await fetch(`${MANGADEX_API}/manga/${id}/feed?${params.toString()}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return { chapters: [], total: 0 };
    let data = await res.json();
    let rawChapters = data.data || [];

    let readableChapters = rawChapters.filter(
      (ch: any) => !ch.attributes?.externalUrl && (ch.attributes?.pages || 0) > 0
    );

    const seenChapters = new Set<string>();
    const chapters: MangaChapter[] = [];

    for (const ch of readableChapters) {
      const attrs = ch.attributes || {};
      const chNum = attrs.chapter || "0";
      const dedupeKey = `${chNum}`;
      if (seenChapters.has(dedupeKey)) continue;
      seenChapters.add(dedupeKey);

      const groupRel = (ch.relationships || []).find((r: any) => r.type === "scanlation_group");
      const groupName = groupRel?.attributes?.name || null;

      chapters.push({
        id: ch.id,
        chapterNumber: chNum,
        volumeNumber: attrs.volume || null,
        title: attrs.title || (chNum !== "0" ? `Chapter ${chNum}` : "Oneshot"),
        language: attrs.translatedLanguage || "en",
        pagesCount: attrs.pages || 0,
        publishAt: attrs.publishAt || attrs.readableAt || new Date().toISOString(),
        scanlationGroup: groupName,
        externalUrl: attrs.externalUrl || null,
        source: "mangadex",
      });
    }

    return {
      chapters,
      total: data.total || chapters.length,
    };
  } catch (err) {
    console.warn(`[MangaFetch] getMangaChapters failed for ${id}:`, err);
    return { chapters: [], total: 0 };
  }
}

/**
 * Fetches high-res page URLs for a chapter.
 */
export async function getChapterPages(chapterId: string): Promise<ChapterPagesData | null> {
  // If WeebCentral chapter
  if (chapterId.startsWith("wc-")) {
    const rawId = chapterId.replace(/^wc-/, "");
    try {
      const res = await fetch(`${WEEBCENTRAL_BASE}/chapters/${rawId}/images?reading_style=long_strip`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "HX-Request": "true",
        },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const html = await res.text();

      const imgUrls = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((url) => url.startsWith("http") && !url.includes("broken_image") && !url.includes("badge"));

      if (imgUrls.length === 0) return null;

      return {
        chapterId,
        chapterNumber: "",
        mangaId: "",
        pageUrls: imgUrls,
        dataSaverUrls: imgUrls,
      };
    } catch (err) {
      console.warn(`[MangaFetch] WeebCentral getChapterPages failed for ${chapterId}:`, err);
      return null;
    }
  }

  // MangaDex chapter pages
  try {
    const res = await fetch(`${MANGADEX_API}/at-home/server/${chapterId}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.baseUrl || !data.chapter?.hash || !data.chapter?.data) {
      return null;
    }

    const baseUrl = data.baseUrl;
    const hash = data.chapter.hash;
    const filenames: string[] = data.chapter.data || [];
    const dataSaverFilenames: string[] = data.chapter.dataSaver || [];

    const pageUrls = filenames.map((fn) => `${baseUrl}/data/${hash}/${fn}`);
    const dataSaverUrls = dataSaverFilenames.map((fn) => `${baseUrl}/data-saver/${hash}/${fn}`);

    return {
      chapterId,
      chapterNumber: "",
      mangaId: "",
      pageUrls,
      dataSaverUrls,
    };
  } catch (err) {
    console.warn(`[MangaFetch] getChapterPages failed for ${chapterId}:`, err);
    return null;
  }
}
