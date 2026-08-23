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
    const rawTitle = titleMatch ? titleMatch[1].trim() : decodeURIComponent(slug.replace(/-/g, " "));
    const title = decodeHtmlEntities(rawTitle);

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
      ? [...tagsMatch[1].matchAll(/<span>([^<,]+),?<\/span>/g)].map((m) => decodeHtmlEntities(m[1]))
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
 * Fetches real-time Trending Now (combined Manga + Manhwa) from WeebCentral.
 */
export async function getMangaTrending(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_trending_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${WEEBCENTRAL_BASE}/search/data?sort=Subscribers&order=Descending&official=Any&anime=Any&adult=False&limit=${limit}`,
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
    console.warn("[MangaFetch] WeebCentral getMangaTrending failed:", err);
  }

  return [];
}

/**
 * Fetches real-time Trending Korean Manhwas from WeebCentral.
 */
export async function getPopularManhwa(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_manhwa_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${WEEBCENTRAL_BASE}/search/data?included_type=Manhwa&sort=Subscribers&order=Descending&official=Any&anime=Any&adult=False&limit=${limit}`,
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
    console.warn("[MangaFetch] WeebCentral getPopularManhwa failed:", err);
  }

  return [];
}

/**
 * Fetches real-time Trending Japanese Mangas from WeebCentral.
 */
export async function getLatestMangaUpdates(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_latest_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${WEEBCENTRAL_BASE}/search/data?included_type=Manga&sort=Subscribers&order=Descending&official=Any&anime=Any&adult=False&limit=${limit}`,
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
    console.warn("[MangaFetch] WeebCentral getLatestMangaUpdates failed:", err);
  }

  return [];
}

/**
 * Searches Asura Scans as secondary fallback.
 */
async function searchAsura(query: string): Promise<MangaItem[]> {
  if (!query?.trim()) return [];
  try {
    const res = await fetch(`${ASURA_API}/search?q=${encodeURIComponent(query.trim())}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 1800 },
    });
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

  const cacheKey = `search_${query}_${type}_${limit}_${offset}_${sortBy}_${genreName}`;
  const cached = getFromCache<{ items: MangaItem[]; total: number }>(cacheKey);
  if (cached) return cached;

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
      // Specific type: Manhwa or Manga
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

    // Secondary fallback to Asura if keyword search had 0 results
    if (query?.trim()) {
      const asuraResults = await searchAsura(query);
      if (asuraResults.length > 0) {
        const result = { items: asuraResults.slice(0, limit), total: asuraResults.length };
        setInCache(cacheKey, result, 1200);
        return result;
      }
    }
  } catch (err) {
    console.warn("[MangaFetch] WeebCentral search failed:", err);
  }

  return { items: [], total: 0 };
}

/**
 * Fetches full details for a Manga/Manhwa from WeebCentral or Asura Scans.
 */
export async function getMangaDetails(id: string): Promise<MangaItem | null> {
  const cacheKey = `details_${id}`;
  const cached = getFromCache<MangaItem>(cacheKey);
  if (cached) return cached;

  // Asura Scans details
  if (id.startsWith("asura-")) {
    const slug = id.replace(/^asura-/, "");
    try {
      const res = await fetch(`${ASURA_API}/series/${slug}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        next: { revalidate: 1800 },
      });
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
    const res = await fetch(`${WEEBCENTRAL_BASE}/series/${rawId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 1800 },
    });
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
 * Helper to fetch Asura Scans chapters.
 */
async function fetchAsuraChapters(seriesSlug: string): Promise<MangaChapter[]> {
  const cacheKey = `chapters_asura_${seriesSlug}`;
  const cached = getFromCache<MangaChapter[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${ASURA_API}/series/${seriesSlug}/chapters`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 900 },
    });
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
export async function getChapterPages(chapterId: string): Promise<ChapterPagesData | null> {
  // Asura chapter pages
  if (chapterId.startsWith("asura-")) {
    const parts = chapterId.replace(/^asura-/, "").split("---");
    const seriesSlug = parts[0];
    const chapterSlug = parts[1];

    try {
      const res = await fetch(`${ASURA_API}/series/${seriesSlug}/chapters/${chapterSlug}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        cache: "no-store",
      });
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

  // WeebCentral chapter pages
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
      chapterId: `wc-${rawId}`,
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
