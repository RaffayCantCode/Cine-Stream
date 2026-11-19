/**
 * Manga and Manhwa Fetching Engine
 * Primary Source: WeebCentral Engine (https://weebcentral.com)
 * Secondary Source: Asura Scans Engine (https://api.asurascans.com)
 * Tertiary Source: MangaKatana Engine (https://mangakatana.com)
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
  source?: "weebcentral" | "asura" | "mangakatana";
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
  source?: "weebcentral" | "asura" | "mangakatana";
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
const MANGAKATANA_BASE = "https://mangakatana.com";

// Bump this whenever fetch logic or data shape changes to instantly drop stale in-memory cache
const CACHE_VERSION = "v15";

const BLOCKED_TAGS = new Set([
  "adult",
  "smut",
  "erotica",
  "hentai",
  "pornographic",
  "doujinshi",
  "sexual violence",
  "sexual content",
  "explicit",
  "r-18",
  "18+",
  "nsfw",
  "ntr",
  "netorare",
  "incest",
  "milf",
]);

const BLOCKED_TITLE_PATTERNS = [
  /\bhentai\b/i,
  /\berotic\b/i,
  /\berotica\b/i,
  /\buncensored\b/i,
  /\bsex\b/i,
  /\bporn\b/i,
  /\bxxx\b/i,
  /\bbondage\b/i,
  /\bsmut\b/i,
  /\braw.*adult\b/i,
  /\br-18\b/i,
  /\b18\+\b/i,
  /\bnsfw\b/i,
  /\bnetorare\b/i,
  /\bntr\b/i,
  /\bfuck\b/i,
  /\bcondom\b/i,
  /\bcreampie\b/i,
  /\bincest\b/i,
  /\bmilf\b/i,
  /\bsecret class\b/i,
  /\bboarding diary\b/i,
  /\bbrawling go\b/i,
  /\berotic scheme\b/i,
];

type ContentRating = MangaItem["contentRating"];

/** Single source of truth for rating tags across list + detail parsing. */
function deriveContentRating(tags?: string[] | null): ContentRating {
  const lower = (tags || []).map((tag) => tag.trim().toLowerCase());

  if (
    lower.some((tag) =>
      ["hentai", "pornographic", "doujinshi", "sexual violence"].includes(tag)
    )
  ) {
    return "pornographic";
  }

  if (
    lower.some((tag) =>
      [
        "adult",
        "smut",
        "erotica",
        "nsfw",
        "18+",
        "r-18",
        "explicit",
        "sexual content",
        "ntr",
        "netorare",
        "incest",
        "milf",
      ].includes(tag)
    )
  ) {
    return "erotica";
  }

  if (
    lower.some((tag) =>
      ["mature", "ecchi", "harem", "suggestive"].includes(tag)
    )
  ) {
    return "suggestive";
  }

  return "safe";
}

/**
 * Single gate for every list/detail surface. Anything tagged Adult, 18+, Smut,
 * NTR, etc. is treated as erotica and rejected so adult manhwa cannot leak in
 * through search, trending, or a stale details cache. Mature/ecchi/harem series
 * remain available as "suggestive".
 */
export function isCleanManga(item: MangaItem): boolean {
  if (!item) return false;
  if (item.contentRating === "erotica" || item.contentRating === "pornographic") return false;

  if (Array.isArray(item.tags)) {
    const hasBlockedTag = item.tags.some((t) => {
      const lower = t.trim().toLowerCase();
      return BLOCKED_TAGS.has(lower);
    });
    if (hasBlockedTag) return false;
  }

  if (item.title) {
    const titleLower = item.title.toLowerCase();
    for (const pat of BLOCKED_TITLE_PATTERNS) {
      if (pat.test(titleLower)) return false;
    }
  }

  if (Array.isArray(item.altTitles)) {
    for (const alt of item.altTitles) {
      const altLower = alt.toLowerCase();
      for (const pat of BLOCKED_TITLE_PATTERNS) {
        if (pat.test(altLower)) return false;
      }
    }
  }

  return true;
}

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
    const coverImage = coverMatch ? coverMatch[1] || coverMatch[0] : `https://temp.compsci88.com/cover/normal/${rawId}.webp`;

    const yearMatch =
      block.match(/<strong>\s*(?:Year|Released):\s*<\/strong>[\s\S]*?(\d{4})/i) ||
      block.match(/<strong>\s*Year:\s*<\/strong>\s*<span>(\d+)<\/span>/i);
    const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

    const statusMatch =
      block.match(/<strong>\s*Status:\s*<\/strong>[\s\S]*?(?:<[a-z0-9]+[^>]*>\s*)*([^<\s]+)/i);
    const rawStatus = statusMatch ? statusMatch[1].trim().toLowerCase() : "";
    const status = rawStatus.includes("complete")
      ? "completed"
      : rawStatus.includes("hiatus")
      ? "hiatus"
      : rawStatus.includes("cancel")
      ? "cancelled"
      : "ongoing";

    const tagsMatch = block.match(/<strong>\s*Tags?\(s\):\s*<\/strong>([\s\S]*?)<\/div>/i);
    const tags = tagsMatch
      ? [...tagsMatch[1].matchAll(/<(?:span|a)[^>]*>\s*([^<,]+),?\s*<\/(?:span|a)>/g)].map((m) => decodeHtmlEntities(m[1].trim()))
      : [];

    const lowerTags = tags.map((t) => t.toLowerCase());

    const typeMatch =
      block.match(/<strong>\s*Type:\s*<\/strong>[\s\S]*?(?:<[a-z0-9]+[^>]*>\s*)*([^<\s]+)/i) ||
      block.match(/included_type=(manhwa|manhua|manga)/i);
    const rawType = typeMatch ? typeMatch[1].trim().toLowerCase() : "";
    const lowerSlug = slug.toLowerCase();

    let type: "manga" | "manhwa" | "manhua" = "manga";
    if (
      rawType === "manhwa" ||
      rawType.includes("manhwa") ||
      lowerSlug.includes("manhwa") ||
      lowerTags.some((t) => t.includes("manhwa") || t.includes("webtoon") || t.includes("korean")) ||
      /infinite mage|solo leveling|raeliana|duke's mansion|tower of god|god of high school|lookism/i.test(title)
    ) {
      type = "manhwa";
    } else if (
      rawType === "manhua" ||
      rawType.includes("manhua") ||
      lowerSlug.includes("manhua") ||
      lowerTags.some((t) => t.includes("manhua") || t.includes("chinese"))
    ) {
      type = "manhua";
    } else {
      type = "manga";
    }

    const contentRating = deriveContentRating(tags);

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
      contentRating,
      originalLanguage: type === "manhwa" ? "ko" : type === "manhua" ? "zh" : "ja",
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

    return seriesList.map((s: any) => {
      const tags = Array.isArray(s.genres)
        ? s.genres.map((g: any) => (typeof g === "string" ? g : g.name || "Action"))
        : ["Action", "Manhwa", "Fantasy"];

      return {
        id: `asura-${s.slug}`,
        title: decodeHtmlEntities(s.title || s.slug),
        altTitles: s.alt_titles || [],
        description:
          decodeHtmlEntities((s.description || "").replace(/<[^>]+>/g, "").trim()) ||
          `Read ${s.title} on CineStream.`,
        coverImage: s.cover || s.cover_url || s.thumbnail || s.thumbnail_url || s.image || "/icon-512.png",
        bannerImage: s.banner || s.banner_url || s.cover || s.cover_url || "/icon-512.png",
        type: "manhwa" as const,
        status: (s.status?.toLowerCase() === "completed" ? "completed" : "ongoing") as any,
        releaseYear: s.release_year || null,
        tags,
        contentRating: deriveContentRating(tags),
        originalLanguage: "ko",
        source: "asura" as const,
      };
    });
  } catch (err) {
    console.warn("[MangaFetch] Asura getAsuraPopularSeries failed:", err);
    return [];
  }
}

// ── MangaKatana Engine (https://mangakatana.com) ────────────────────────────

function classifyMangaKatanaType(tags: string[], title: string): "manga" | "manhwa" | "manhua" {
  const lowerTags = tags.map((t) => t.toLowerCase());
  if (
    lowerTags.some((t) => t.includes("manhwa") || t.includes("webtoon") || t.includes("korean")) ||
    /solo leveling|tower of god|god of high school|eleceed|omniscient reader|overgeared|nano machine|murim|return of the|infinite mage|lookism/i.test(title)
  ) {
    return "manhwa";
  }
  if (lowerTags.some((t) => t.includes("manhua") || t.includes("chinese"))) {
    return "manhua";
  }
  return "manga";
}

function parseMangaKatanaListHtml(html: string): MangaItem[] {
  if (!html) return [];
  const bookListIdx = html.indexOf('id="book_list"');
  const slice = bookListIdx >= 0 ? html.slice(bookListIdx) : html;
  const blocks = slice.split(/<div class="item"[^>]*>/i).slice(1);
  const items: MangaItem[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const linkMatch = block.match(/<h3 class="title"[^>]*>[\s\S]*?<a[^>]*href="https?:\/\/mangakatana\.com\/manga\/([^"/?#]+)"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/href="https?:\/\/mangakatana\.com\/manga\/([^"/?#]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const rawSlug = linkMatch[1].trim();
    if (!rawSlug || rawSlug === "page" || rawSlug.includes("/")) continue;
    const id = `mk-${rawSlug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const title = decodeHtmlEntities(linkMatch[2].replace(/<[^>]+>/g, "").trim());
    if (!title) continue;

    const coverMatch =
      block.match(/<img[^>]*src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
      block.match(/srcset="(https?:\/\/[^"\s]+\.(?:webp|jpg|jpeg|png))"/i);
    const coverImage = coverMatch ? coverMatch[1] : "";
    if (!coverImage) continue;

    const statusMatch = block.match(/<div class="status\s+([^"]+)"/i);
    const rawStatus = statusMatch ? statusMatch[1].toLowerCase() : "";
    const status: MangaItem["status"] = rawStatus.includes("completed")
      ? "completed"
      : rawStatus.includes("hiatus")
      ? "hiatus"
      : "ongoing";

    const genresMatch = block.match(/<div class="genres[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const tags = genresMatch
      ? [...genresMatch[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map((m) => decodeHtmlEntities(m[1].trim())).filter(Boolean)
      : ["Action"];

    const summaryMatch = block.match(/<div class="summary"[^>]*>([\s\S]*?)<\/div>/i);
    const description = summaryMatch
      ? decodeHtmlEntities(summaryMatch[1].replace(/<[^>]+>/g, "").trim())
      : `Read ${title} on CineStream.`;

    const type = classifyMangaKatanaType(tags, title);
    const contentRating = deriveContentRating(tags);

    const item: MangaItem = {
      id,
      title,
      description: description || `Read ${title} on CineStream.`,
      coverImage,
      bannerImage: coverImage,
      type,
      status,
      releaseYear: null,
      tags: tags.length > 0 ? tags : ["Action"],
      contentRating,
      originalLanguage: type === "manhwa" ? "ko" : type === "manhua" ? "zh" : "ja",
      source: "mangakatana",
    };

    if (isCleanManga(item)) {
      items.push(item);
    }
  }

  return items;
}

function parseMangaKatanaDetailHtml(html: string, rawSlug: string): MangaItem | null {
  if (!html || !html.includes('id="single_book"')) return null;

  const titleMatch = html.match(/<h1 class="heading"[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, "").trim()) : rawSlug.replace(/\.\d+$/, "").replace(/-/g, " ");
  if (!title) return null;

  const coverSection = html.match(/<div class="cover"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const coverMatch =
    coverSection.match(/<img[^>]*src="(https?:\/\/[^"]+)"/i) ||
    coverSection.match(/srcset="(https?:\/\/[^"\s]+\.(?:webp|jpg|jpeg|png))"/i) ||
    html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  const coverImage = coverMatch ? coverMatch[1] : "/icon-512.png";

  const altMatch = html.match(/<div class="alt_name"[^>]*>([\s\S]*?)<\/div>/i);
  const altTitles = altMatch
    ? decodeHtmlEntities(altMatch[1].replace(/<[^>]+>/g, "")).split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean)
    : [];

  const authorsMatch = html.match(/<div class="authors"[^>]*>([\s\S]*?)<\/div>/i);
  const authors = authorsMatch
    ? [...authorsMatch[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map((m) => decodeHtmlEntities(m[1].trim())).filter(Boolean)
    : [];

  const genresMatch = html.match(/<div class="genres"[^>]*>([\s\S]*?)<\/div>/i);
  const tags = genresMatch
    ? [...genresMatch[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map((m) => decodeHtmlEntities(m[1].trim())).filter(Boolean)
    : ["Action"];

  const statusMatch = html.match(/<div class="value status\s+([^"]+)"/i);
  const rawStatus = statusMatch ? statusMatch[1].toLowerCase() : "";
  const status: MangaItem["status"] = rawStatus.includes("completed")
    ? "completed"
    : rawStatus.includes("hiatus")
    ? "hiatus"
    : "ongoing";

  const summaryMatch = html.match(/<div class="summary"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  const description = summaryMatch
    ? decodeHtmlEntities(summaryMatch[1].replace(/<[^>]+>/g, "").trim())
    : `Read ${title} on CineStream.`;

  const type = classifyMangaKatanaType(tags, title);
  const item: MangaItem = {
    id: `mk-${rawSlug}`,
    title,
    altTitles: altTitles.length > 0 ? altTitles : undefined,
    description: description || `Read ${title} on CineStream.`,
    coverImage,
    bannerImage: coverImage,
    type,
    status,
    releaseYear: null,
    authors: authors.length > 0 ? authors : undefined,
    tags: tags.length > 0 ? tags : ["Action"],
    contentRating: deriveContentRating(tags),
    originalLanguage: type === "manhwa" ? "ko" : type === "manhua" ? "zh" : "ja",
    source: "mangakatana",
  };

  return isCleanManga(item) ? item : null;
}

async function getMangaKatanaList(
  order: "views" | "latest" | "new" = "views",
  page = 1,
  limit = 24
): Promise<MangaItem[]> {
  try {
    const url = `${MANGAKATANA_BASE}/manga/page/${page}?filter=1&include_mode=and&bookmark_opts=off&chapters=1&order=${order}`;
    const res = await fetchWithTimeout(url, { next: { revalidate: 1800 } } as any, 5500);
    if (!res.ok) return [];
    const html = await res.text();
    return parseMangaKatanaListHtml(html).slice(0, limit);
  } catch (err) {
    console.warn("[MangaFetch] MangaKatana list failed:", err);
    return [];
  }
}

async function searchMangaKatana(query: string, limit = 20): Promise<MangaItem[]> {
  if (!query?.trim()) return [];
  try {
    const url = `${MANGAKATANA_BASE}/?search=${encodeURIComponent(query.trim())}&search_by=book_name`;
    const res = await fetchWithTimeout(url, { cache: "no-store", redirect: "follow" }, 5500);
    if (!res.ok) return [];
    const html = await res.text();

    // MangaKatana redirects straight to /manga/slug.id when there is an exact single match
    if (html.includes('id="single_book"')) {
      const slugMatch = (res.url || "").match(/\/manga\/([^/?#]+)/i)
        || html.match(/<link rel="canonical" href="https?:\/\/mangakatana\.com\/manga\/([^/?#"]+)"/i);
      if (slugMatch?.[1]) {
        const single = parseMangaKatanaDetailHtml(html, slugMatch[1]);
        return single ? [single] : [];
      }
    }

    return parseMangaKatanaListHtml(html).slice(0, limit);
  } catch (err) {
    console.warn("[MangaFetch] MangaKatana search failed:", err);
    return [];
  }
}

async function fetchMangaKatanaChapters(rawSlug: string): Promise<MangaChapter[]> {
  const cacheKey = `chapters_mk_${rawSlug}`;
  const cached = getFromCache<MangaChapter[]>(cacheKey);
  if (cached) return cached;

  return dedupeRequest(cacheKey, async () => {
    try {
      const res = await fetchWithTimeout(`${MANGAKATANA_BASE}/manga/${rawSlug}`, {
        next: { revalidate: 900 },
      } as any, 6000);
      if (!res.ok) return [];
      const html = await res.text();
      const chSectionIdx = html.indexOf('class="chapters"');
      if (chSectionIdx < 0) return [];
      const chHtml = html.slice(chSectionIdx);

      const chapters: MangaChapter[] = [];
      const seen = new Set<string>();
      const rowRegex = /<tr[^>]*>[\s\S]*?<div class="chapter"[^>]*>\s*<a[^>]*href="https?:\/\/mangakatana\.com\/manga\/[^/]+\/([^"?#]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<div class="update_time"[^>]*>([\s\S]*?)<\/div>)?[\s\S]*?<\/tr>/gi;

      let match: RegExpExecArray | null;
      while ((match = rowRegex.exec(chHtml)) !== null) {
        const chSlug = match[1].trim();
        const chId = `mkch-${rawSlug}__${chSlug}`;
        if (seen.has(chId)) continue;
        seen.add(chId);

        const rawTitle = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, "").trim());
        const numMatch = chSlug.match(/c(\d+(?:\.\d+)?)/i) || rawTitle.match(/(?:ch(?:apter)?\.?\s*)(\d+(?:\.\d+)?)/i) || rawTitle.match(/(\d+(?:\.\d+)?)/);
        const chNum = numMatch ? numMatch[1] : "0";
        const publishAt = match[3] ? decodeHtmlEntities(match[3].replace(/<[^>]+>/g, "").trim()) : "";

        chapters.push({
          id: chId,
          chapterNumber: chNum,
          title: rawTitle || `Chapter ${chNum}`,
          language: "en",
          pagesCount: 1,
          publishAt,
          scanlationGroup: "MangaKatana",
          source: "mangakatana",
        });
      }

      setInCache(cacheKey, chapters, 900);
      return chapters;
    } catch (err) {
      console.warn(`[MangaFetch] fetchMangaKatanaChapters failed for ${rawSlug}:`, err);
      return [];
    }
  });
}

async function getMangaKatanaChapterPages(chapterId: string): Promise<ChapterPagesData | null> {
  const stripped = chapterId.replace(/^mkch-/, "");
  const sepIdx = stripped.indexOf("__");
  if (sepIdx < 0) return null;
  const rawSlug = stripped.slice(0, sepIdx);
  const chSlug = stripped.slice(sepIdx + 2);
  if (!rawSlug || !chSlug) return null;

  try {
    const res = await fetchWithTimeout(`${MANGAKATANA_BASE}/manga/${rawSlug}/${chSlug}`, {
      cache: "no-store",
    }, 6500);
    if (!res.ok) return null;
    const html = await res.text();

    // MangaKatana embeds the full chapter page array in `var thzq=[...]` (fallback `htnc` / `ytaw`)
    const varMatch =
      html.match(/var\s+thzq\s*=\s*\[([\s\S]*?)\]/i) ||
      html.match(/var\s+htnc\s*=\s*\[([\s\S]*?)\]/i) ||
      html.match(/var\s+ytaw\s*=\s*\[([\s\S]*?)\]/i);

    if (!varMatch) return null;

    const imgUrls: string[] = [];
    const seen = new Set<string>();
    const urlMatches = varMatch[1].matchAll(/['"](https?:\/\/[^'"]+)['"]/g);
    for (const m of urlMatches) {
      const url = m[1].trim();
      if (url && !seen.has(url)) {
        seen.add(url);
        imgUrls.push(url);
      }
    }

    if (imgUrls.length === 0) return null;

    const numMatch = chSlug.match(/c(\d+(?:\.\d+)?)/i);
    return {
      chapterId,
      chapterNumber: numMatch ? numMatch[1] : "",
      mangaId: `mk-${rawSlug}`,
      pageUrls: imgUrls,
      dataSaverUrls: imgUrls,
    };
  } catch (err) {
    console.warn(`[MangaFetch] MangaKatana getChapterPages failed for ${chapterId}:`, err);
    return null;
  }
}

function mergeDedupeMangaLists(lists: MangaItem[][], limit: number): MangaItem[] {
  const seen = new Set<string>();
  const combined: MangaItem[] = [];
  const maxLen = Math.max(0, ...lists.map((l) => l.length));

  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (i >= list.length) continue;
      const item = list[i];
      if (!item || !item.title || !isCleanManga(item)) continue;
      const norm = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      combined.push(item);
      if (combined.length >= limit) return combined;
    }
  }
  return combined;
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
      // Fetch dynamic daily trending, latest & popular Manhwa and Manga in parallel across WeebCentral, Asura & MangaKatana
      const [manhwaRes, mangaRes, latestRes, mkViews, mkLatest, asuraPop] = await Promise.all([
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
        fetchWithTimeout(
          `${WEEBCENTRAL_BASE}/search/data?sort=Latest%20Updates&order=Descending&official=Any&anime=Any&adult=False&limit=${half}`,
          { headers: { "HX-Request": "true" }, next: { revalidate: 900 } } as any,
          5000
        ).catch(() => null),
        getMangaKatanaList("views", 1, half).catch(() => [] as MangaItem[]),
        getMangaKatanaList("latest", 1, half).catch(() => [] as MangaItem[]),
        getAsuraPopularSeries(half).catch(() => [] as MangaItem[]),
      ]);

      let manhwaItems: MangaItem[] = [];
      let mangaItems: MangaItem[] = [];
      let latestItems: MangaItem[] = [];

      if (manhwaRes && manhwaRes.ok) {
        manhwaItems = parseWeebCentralHtml(await manhwaRes.text()).filter(
          (item) => item.type === "manhwa" && isCleanManga(item)
        );
      }
      if (mangaRes && mangaRes.ok) {
        mangaItems = parseWeebCentralHtml(await mangaRes.text()).filter(
          (item) => item.type === "manga" && isCleanManga(item)
        );
      }
      if (latestRes && latestRes.ok) {
        latestItems = parseWeebCentralHtml(await latestRes.text()).filter(isCleanManga);
      }

      const combined = mergeDedupeMangaLists(
        [manhwaItems, mangaItems, mkViews, asuraPop, latestItems, mkLatest],
        limit
      );

      if (combined.length > 0) {
        setInCache(cacheKey, combined, 900);
        return combined;
      }
    } catch (err) {
      console.warn("[MangaFetch] WeebCentral getMangaTrending failed:", err);
    }

    // Fallback 1: Balanced search (already does 50/50 interleave internally)
    try {
      const fallbackSearch = await searchManga("", { type: "all", limit, sortBy: "rating" });
      if (fallbackSearch.items && fallbackSearch.items.length > 0) {
        const clean = fallbackSearch.items.filter(isCleanManga);
        setInCache(cacheKey, clean, 900);
        return clean;
      }
    } catch {}

    // Fallback 2: Asura Scans popular manhwas
    const asuraItems = (await getAsuraPopularSeries(limit)).filter(
      (item) => item.type === "manhwa" && isCleanManga(item)
    );
    if (asuraItems.length > 0) {
      setInCache(cacheKey, asuraItems, 900);
      return asuraItems;
    }

    return [];
  });
}

/**
 * Fetches real-time Trending Korean Manhwas combining WeebCentral popularity and Asura live active series.
 */
export async function getPopularManhwa(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_manhwa_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  return dedupeRequest(cacheKey, async () => {
    try {
      const [wcRes, wcLatestRes, asuraItems, mkViews] = await Promise.all([
        fetchWithTimeout(
          `${WEEBCENTRAL_BASE}/search/data?included_type=Manhwa&sort=Popularity&order=Descending&official=Any&anime=Any&adult=False&limit=${limit}`,
          {
            headers: {
              "HX-Request": "true",
            },
            next: { revalidate: 900 },
          } as any,
          5000
        ).catch(() => null),
        fetchWithTimeout(
          `${WEEBCENTRAL_BASE}/search/data?included_type=Manhwa&sort=Latest%20Updates&order=Descending&official=Any&anime=Any&adult=False&limit=${Math.ceil(limit / 2)}`,
          {
            headers: {
              "HX-Request": "true",
            },
            next: { revalidate: 900 },
          } as any,
          5000
        ).catch(() => null),
        getAsuraPopularSeries(limit).then((items) =>
          items.filter((item) => item.type === "manhwa" && isCleanManga(item))
        ).catch(() => [] as MangaItem[]),
        getMangaKatanaList("views", 1, limit).then((items) =>
          items.filter((item) => item.type === "manhwa" && isCleanManga(item))
        ).catch(() => [] as MangaItem[]),
      ]);

      let wcItems: MangaItem[] = [];
      let wcLatestItems: MangaItem[] = [];
      if (wcRes && wcRes.ok) {
        const html = await wcRes.text();
        wcItems = parseWeebCentralHtml(html).filter(
          (item) => item.type === "manhwa" && isCleanManga(item)
        );
      }
      if (wcLatestRes && wcLatestRes.ok) {
        const html = await wcLatestRes.text();
        wcLatestItems = parseWeebCentralHtml(html).filter(
          (item) => item.type === "manhwa" && isCleanManga(item)
        );
      }

      const combined = mergeDedupeMangaLists([wcItems, asuraItems, wcLatestItems, mkViews], limit);

      if (combined.length > 0) {
        setInCache(cacheKey, combined, 900);
        return combined;
      }
    } catch (err) {
      console.warn("[MangaFetch] WeebCentral getPopularManhwa failed:", err);
    }

    // Fallback 1: Asura Scans dedicated series API (all manhwas)
    const asuraItems = (await getAsuraPopularSeries(limit)).filter(
      (item) => item.type === "manhwa" && isCleanManga(item)
    );
    if (asuraItems.length > 0) {
      setInCache(cacheKey, asuraItems, 900);
      return asuraItems;
    }

    // Fallback 2: searchManga for manhwa
    try {
      const fallbackSearch = await searchManga("", { type: "manhwa", limit, sortBy: "rating" });
      if (fallbackSearch.items && fallbackSearch.items.length > 0) {
        const clean = fallbackSearch.items.filter(
          (item) => item.type === "manhwa" && isCleanManga(item)
        );
        setInCache(cacheKey, clean, 900);
        return clean;
      }
    } catch {}

    return [];
  });
}

/**
 * Fetches real-time Popular / Trending Japanese Mangas from WeebCentral with search fallback.
 */
export async function getPopularManga(limit = 32): Promise<MangaItem[]> {
  const cacheKey = `manga_popular_manga_${limit}`;
  const cached = getFromCache<MangaItem[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  return dedupeRequest(cacheKey, async () => {
    try {
      const [res, latestRes, mkViews, mkNew] = await Promise.all([
        fetchWithTimeout(
          `${WEEBCENTRAL_BASE}/search/data?included_type=Manga&sort=Popularity&order=Descending&official=Any&anime=Any&adult=False&limit=${limit}`,
          {
            headers: {
              "HX-Request": "true",
            },
            next: { revalidate: 900 },
          } as any,
          5000
        ).catch(() => null),
        fetchWithTimeout(
          `${WEEBCENTRAL_BASE}/search/data?included_type=Manga&sort=Latest%20Updates&order=Descending&official=Any&anime=Any&adult=False&limit=${Math.ceil(limit / 2)}`,
          {
            headers: {
              "HX-Request": "true",
            },
            next: { revalidate: 900 },
          } as any,
          5000
        ).catch(() => null),
        getMangaKatanaList("views", 1, limit).then((items) =>
          items.filter((item) => item.type === "manga" && isCleanManga(item))
        ).catch(() => [] as MangaItem[]),
        getMangaKatanaList("new", 1, Math.ceil(limit / 2)).then((items) =>
          items.filter((item) => item.type === "manga" && isCleanManga(item))
        ).catch(() => [] as MangaItem[]),
      ]);

      let wcItems: MangaItem[] = [];
      let wcLatestItems: MangaItem[] = [];
      if (res && res.ok) {
        const html = await res.text();
        wcItems = parseWeebCentralHtml(html).filter(
          (item) => item.type === "manga" && isCleanManga(item)
        );
      }
      if (latestRes && latestRes.ok) {
        const html = await latestRes.text();
        wcLatestItems = parseWeebCentralHtml(html).filter(
          (item) => item.type === "manga" && isCleanManga(item)
        );
      }

      const combined = mergeDedupeMangaLists([wcItems, mkViews, wcLatestItems, mkNew], limit);
      if (combined.length > 0) {
        setInCache(cacheKey, combined, 900);
        return combined;
      }
    } catch (err) {
      console.warn("[MangaFetch] WeebCentral getPopularManga failed:", err);
    }

    // Fallback: searchManga for manga sorted by followedCount
    try {
      const fallbackSearch = await searchManga("", { type: "manga", limit, sortBy: "followedCount" });
      if (fallbackSearch.items && fallbackSearch.items.length > 0) {
        const clean = fallbackSearch.items.filter(
          (item) => item.type === "manga" && isCleanManga(item)
        );
        setInCache(cacheKey, clean, 900);
        return clean;
      }
    } catch {}

    return [];
  });
}

/**
 * Fetches real-time Latest Updated Japanese Mangas from WeebCentral with search fallback.
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
        const items = parseWeebCentralHtml(html).filter(isCleanManga);
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
        const clean = fallbackSearch.items.filter(isCleanManga);
        setInCache(cacheKey, clean, 900);
        return clean;
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

    return seriesList.map((s: any) => {
      const cover = s.cover || s.cover_url || s.thumbnail || s.thumbnail_url || s.image || "/icon-512.png";
      const banner = s.banner || s.cover || s.cover_url || "/icon-512.png";
      return {
        id: `asura-${s.slug}`,
        title: decodeHtmlEntities(s.title || s.slug),
        altTitles: s.alt_titles || s.alternative_titles || [],
        description: decodeHtmlEntities((s.description || "").replace(/<[^>]+>/g, "").trim()) || `Read ${s.title} on CineStream.`,
        coverImage: cover,
        bannerImage: banner,
        type: "manhwa" as const,
        status: (s.status?.toLowerCase() === "completed" ? "completed" : "ongoing") as any,
        releaseYear: s.release_year || null,
        tags: Array.isArray(s.genres)
          ? s.genres.map((g: any) => (typeof g === "string" ? g : g.name || "Action"))
          : ["Action", "Manhwa", "Fantasy"],
        contentRating: "safe" as const,
        originalLanguage: "ko",
        source: "asura" as const,
      };
    });
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

      // 1. Text Search Mode: Query WeebCentral + MangaKatana + Asura Scans in parallel for maximum library coverage
      if (query?.trim()) {
        const typeParam =
          type === "manhwa"
            ? "&included_type=Manhwa"
            : type === "manga"
            ? "&included_type=Manga"
            : "";

        const [wcRes, mkResults, asuraResults] = await Promise.all([
          fetchWithTimeout(
            `${WEEBCENTRAL_BASE}/search/data?official=Any&anime=Any&adult=False${sortParam}${typeParam}${tagParam}${textParam}&offset=${offset}&limit=${limit}`,
            {
              headers: {
                "HX-Request": "true",
              },
              cache: "no-store",
            },
            6000
          ).catch(() => null),
          offset === 0 ? searchMangaKatana(query.trim(), limit).catch(() => [] as MangaItem[]) : Promise.resolve([] as MangaItem[]),
          offset === 0 ? searchAsura(query.trim()).catch(() => [] as MangaItem[]) : Promise.resolve([] as MangaItem[]),
        ]);

        let wcItems: MangaItem[] = [];
        if (wcRes && wcRes.ok) {
          const html = await wcRes.text();
          wcItems = parseWeebCentralHtml(html).filter(isCleanManga);
        }

        const filterByType = (arr: MangaItem[]) =>
          type === "all" ? arr.filter(isCleanManga) : arr.filter((i) => i.type === type && isCleanManga(i));

        const combined = mergeDedupeMangaLists(
          [wcItems, filterByType(mkResults), filterByType(asuraResults)],
          limit
        );

        if (combined.length > 0) {
          const result = { items: combined, total: Math.max(combined.length, wcItems.length > 0 ? 500 : combined.length) };
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
          manhwaItems = parseWeebCentralHtml(html).filter(isCleanManga);
        }
        if (mangaRes && mangaRes.ok) {
          const html = await mangaRes.text();
          mangaItems = parseWeebCentralHtml(html).filter(isCleanManga);
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
          const items = parseWeebCentralHtml(html).filter(isCleanManga);
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

// ── Smart Cross-Source Failover Helpers ─────────────────────────────────────

function normalizeMangaTitle(title: string): string {
  return (title || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function deriveTitleFromMangaId(id: string): string {
  if (!id) return "";
  if (id.startsWith("asura-")) {
    const base = id.replace(/^asura-/, "").split("---")[0];
    return base.replace(/-[a-f0-9]{6,}$/i, "").replace(/-/g, " ").trim();
  }
  if (id.startsWith("mkch-")) {
    const base = id.replace(/^mkch-/, "").split("__")[0];
    return base.replace(/\.\d+$/, "").replace(/-/g, " ").trim();
  }
  if (id.startsWith("mk-")) {
    return id.replace(/^mk-/, "").replace(/\.\d+$/, "").replace(/-/g, " ").trim();
  }
  return "";
}

function deriveChapterNumFromId(chapterId: string): string {
  if (!chapterId) return "";
  if (chapterId.startsWith("mkch-")) {
    const chSlug = chapterId.split("__")[1] || "";
    const m = chSlug.match(/c(\d+(?:\.\d+)?)/i) || chSlug.match(/(\d+(?:\.\d+)?)/);
    return m ? m[1] : "";
  }
  if (chapterId.startsWith("asura-")) {
    const chSlug = chapterId.split("---")[1] || "";
    const m = chSlug.match(/(\d+(?:\.\d+)?)/);
    return m ? m[1] : "";
  }
  return "";
}

function pickBestTitleMatch(items: MangaItem[], targetTitle: string): MangaItem | null {
  const target = normalizeMangaTitle(targetTitle);
  if (!target || !items || items.length === 0) return null;
  const targetWords = new Set(target.split(" ").filter((w) => w.length > 1));

  let best: MangaItem | null = null;
  let bestScore = 0;

  for (const item of items) {
    if (!item || !isCleanManga(item)) continue;
    const candidates = [item.title, ...(item.altTitles || [])].map(normalizeMangaTitle).filter(Boolean);
    for (const cand of candidates) {
      let score = 0;
      if (cand === target) {
        score = 100;
      } else if (cand.startsWith(target) || target.startsWith(cand)) {
        score = 82;
      } else if (cand.includes(target) || target.includes(cand)) {
        score = 72;
      } else if (targetWords.size > 0) {
        const candWords = new Set(cand.split(" ").filter((w) => w.length > 1));
        let overlap = 0;
        for (const w of targetWords) {
          if (candWords.has(w)) overlap++;
        }
        const union = targetWords.size + candWords.size - overlap;
        score = union > 0 ? Math.round((overlap / union) * 68) : 0;
      }

      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
  }

  return bestScore >= 40 ? best : null;
}

async function searchWeebCentralDirect(query: string, limit = 8): Promise<MangaItem[]> {
  if (!query?.trim()) return [];
  try {
    const res = await fetchWithTimeout(
      `${WEEBCENTRAL_BASE}/search/data?official=Any&anime=Any&adult=False&sort=Popularity&order=Descending&text=${encodeURIComponent(query.trim())}&limit=${limit}`,
      { headers: { "HX-Request": "true" }, cache: "no-store" },
      5500
    );
    if (!res.ok) return [];
    const html = await res.text();
    return parseWeebCentralHtml(html).filter(isCleanManga);
  } catch {
    return [];
  }
}

/**
 * Smart cover failover: when a cover image from one source fails to load on the
 * home page or details page, searches the other two sources for the same title
 * and returns a working cover URL.
 */
export async function findAlternativeMangaCover(
  title: string,
  excludeSource?: string
): Promise<string | null> {
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) return null;

  const cacheKey = `alt_cover_${normalizeMangaTitle(cleanTitle)}_${excludeSource || "any"}`;
  const cached = getFromCache<string>(cacheKey);
  if (cached) return cached;

  return dedupeRequest(cacheKey, async () => {
    const exclude = (excludeSource || "").toLowerCase();
    const searches: Promise<MangaItem[]>[] = [];
    if (exclude !== "weebcentral") searches.push(searchWeebCentralDirect(cleanTitle, 6));
    if (exclude !== "mangakatana") searches.push(searchMangaKatana(cleanTitle, 6));
    if (exclude !== "asura") searches.push(searchAsura(cleanTitle));

    const results = await Promise.all(searches.map((p) => p.catch(() => [] as MangaItem[])));
    for (const list of results) {
      const match = pickBestTitleMatch(list, cleanTitle);
      if (match?.coverImage && match.coverImage.startsWith("https://") && !match.coverImage.includes("icon-512.png")) {
        setInCache(cacheKey, match.coverImage, 3600);
        return match.coverImage;
      }
    }
    return null;
  });
}

/**
 * Fetches full details for a Manga/Manhwa from MangaKatana, Asura Scans, or WeebCentral
 * with automatic cross-source failover when the primary source fails.
 */
export async function getMangaDetails(id: string, fallbackTitle?: string): Promise<MangaItem | null> {
  const cacheKey = `details_${id}`;
  const cached = getFromCache<MangaItem>(cacheKey);
  if (cached) {
    if (!isCleanManga(cached)) return null;
    const lowerTags = (cached.tags || []).map((t) => t.toLowerCase());
    if (
      lowerTags.some((t) => t.includes("manhwa") || t.includes("webtoon") || t.includes("korean")) ||
      /infinite mage|solo leveling|raeliana|duke's mansion|tower of god|god of high school|lookism/i.test(cached.title) ||
      id.startsWith("asura-")
    ) {
      cached.type = "manhwa";
    } else if (lowerTags.some((t) => t.includes("manhua") || t.includes("chinese"))) {
      cached.type = "manhua";
    }
    return cached;
  }

  return dedupeRequest(cacheKey, async () => {
    const primarySource = id.startsWith("mk-")
      ? "mangakatana"
      : id.startsWith("asura-")
      ? "asura"
      : "weebcentral";

    // 1. Primary source attempt: MangaKatana
    if (primarySource === "mangakatana") {
      const rawSlug = id.replace(/^mk-/, "");
      try {
        const res = await fetchWithTimeout(`${MANGAKATANA_BASE}/manga/${rawSlug}`, {
          next: { revalidate: 1800 },
        } as any, 6000);
        if (res.ok) {
          const html = await res.text();
          const item = parseMangaKatanaDetailHtml(html, rawSlug);
          if (item) {
            setInCache(cacheKey, item, 1800);
            return item;
          }
        }
      } catch (err) {
        console.warn(`[MangaFetch] MangaKatana getMangaDetails failed for ${id}:`, err);
      }
    }

    // 2. Primary source attempt: Asura Scans
    if (primarySource === "asura") {
      const slug = id.replace(/^asura-/, "");
      try {
        const res = await fetchWithTimeout(`${ASURA_API}/series/${slug}`, {
          next: { revalidate: 1800 },
        } as any, 5000);
        if (res.ok) {
          const data = await res.json();
          const s = data.series || data.data || data;
          const cover = s.cover || s.cover_url || s.thumbnail || s.thumbnail_url || s.image || "/icon-512.png";
          const banner = s.banner || s.cover || s.cover_url || cover;
          const item: MangaItem = {
            id: `asura-${slug}`,
            title: decodeHtmlEntities(s.title || slug),
            altTitles: s.alt_titles || s.alternative_titles || [],
            description: decodeHtmlEntities((s.description || "").replace(/<[^>]+>/g, "").trim()) || `Read ${s.title || slug} on CineStream.`,
            coverImage: cover,
            bannerImage: banner,
            type: (s.type?.toLowerCase() === "manhwa" || s.type?.toLowerCase() === "manhua" || s.type?.toLowerCase() === "manga") ? s.type.toLowerCase() : "manhwa",
            status: (s.status?.toLowerCase() === "completed" ? "completed" : "ongoing") as any,
            releaseYear: s.release_year || null,
            tags: (s.genres || ["Action", "Manhwa", "Fantasy"]).map((g: any) => typeof g === "string" ? g : g.name || "Action"),
            contentRating: deriveContentRating(
              (s.genres || []).map((g: any) => (typeof g === "string" ? g : g.name || "Action"))
            ),
            originalLanguage: "ko",
            source: "asura",
          };
          if (isCleanManga(item)) {
            setInCache(cacheKey, item, 1800);
            return item;
          }
        }
      } catch (err) {
        console.warn(`[MangaFetch] Asura getMangaDetails failed for ${id}:`, err);
      }
    }

    // 3. Primary source attempt: WeebCentral
    if (primarySource === "weebcentral") {
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
          const coverMatch =
            html.match(new RegExp(`https:\\/\\/temp\\.compsci88\\.com\\/cover\\/normal\\/${rawId}\\.webp`, "i")) ||
            html.match(/<source[^>]*srcset="([^"]*temp\.compsci88\.com\/cover\/normal\/[^"]+)"/i) ||
            html.match(/<img[^>]*alt="[^"]*cover"[^>]*src="([^"]+)"/i) ||
            html.match(/<img[^>]*src="([^"]+)"[^>]*alt="[^"]*cover"/i) ||
            html.match(new RegExp(`https:\\/\\/temp\\.compsci88\\.com\\/cover\\/(?:fallback\\/)?${rawId}[^"'\s]*`, "i")) ||
            html.match(/https:\/\/temp\.compsci88\.com\/cover\/[^\s"']+/i) ||
            html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
            html.match(/srcset="(https:\/\/[^"\s]+\.(?:webp|jpg|jpeg|png))"/i) ||
            html.match(/(https:\/\/(?:temp\.compsci88\.com|weebcentral\.com|cdn\.[^"'\s]+)\/[^\s"']+)/i);
          const coverImage = coverMatch ? (coverMatch[1] || coverMatch[0]) : `https://temp.compsci88.com/cover/normal/${rawId}.webp`;

          const yearMatch =
            html.match(/<strong>\s*(?:Released|Year):\s*<\/strong>[\s\S]*?(\d{4})/i) ||
            html.match(/<strong>\s*(?:Released|Year):<\/strong>\s*<span>(\d+)<\/span>/i);
          const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

          const statusMatch =
            html.match(/<strong>\s*Status:\s*<\/strong>[\s\S]*?(?:<[a-z0-9]+[^>]*>\s*)*([^<\s]+)/i);
          const rawStatus = statusMatch ? statusMatch[1].trim().toLowerCase() : "";
          const status = rawStatus.includes("complete")
            ? "completed"
            : rawStatus.includes("hiatus")
            ? "hiatus"
            : rawStatus.includes("cancel")
            ? "cancelled"
            : "ongoing";

          const typeMatch =
            html.match(/<strong>\s*Type:\s*<\/strong>[\s\S]*?(?:<[a-z0-9]+[^>]*>\s*)*([^<\s]+)/i) ||
            html.match(/included_type=(manhwa|manhua|manga)/i);
          const rawType = typeMatch ? typeMatch[1].trim().toLowerCase() : "";

          const tagsMatch =
            html.match(/<strong>\s*Tags?\(s\):\s*<\/strong>([\s\S]*?)<\/li>/i) ||
            html.match(/<strong>\s*Tags?\(s\):\s*<\/strong>([\s\S]*?)<\/div>/i);
          const tags = tagsMatch
            ? [...tagsMatch[1].matchAll(/<(?:span|a)[^>]*>\s*([^<,]+),?\s*<\/(?:span|a)>/g)].map((m) => decodeHtmlEntities(m[1].trim()))
            : [];
          const lowerTags = tags.map((t) => t.toLowerCase());

          const authorMatch = html.match(/<strong>\s*Author\(s\):\s*<\/strong>([\s\S]*?)<\/li>/i);
          const authors = authorMatch
            ? [...authorMatch[1].matchAll(/<(?:span|a)[^>]*>\s*([^<,]+),?\s*<\/(?:span|a)>/g)].map((m) => decodeHtmlEntities(m[1].trim()))
            : [];

          let type: "manga" | "manhwa" | "manhua" = "manga";
          if (
            rawType === "manhwa" ||
            rawType.includes("manhwa") ||
            lowerTags.some((t) => t.includes("manhwa") || t.includes("webtoon") || t.includes("korean")) ||
            /infinite mage|solo leveling|raeliana|duke's mansion|tower of god|god of high school|lookism/i.test(title)
          ) {
            type = "manhwa";
          } else if (
            rawType === "manhua" ||
            rawType.includes("manhua") ||
            lowerTags.some((t) => t.includes("manhua") || t.includes("chinese"))
          ) {
            type = "manhua";
          }

          const item: MangaItem = {
            id: `wc-${rawId}`,
            title,
            description,
            coverImage,
            bannerImage: coverImage,
            type,
            status,
            releaseYear,
            authors: authors.length > 0 ? authors : undefined,
            tags: tags.length > 0 ? tags : ["Action"],
            contentRating: deriveContentRating(tags),
            originalLanguage: type === "manhwa" ? "ko" : type === "manhua" ? "zh" : "ja",
            source: "weebcentral",
          };

          if (isCleanManga(item)) {
            setInCache(cacheKey, item, 1800);
            return item;
          }
        }
      } catch (err) {
        console.warn(`[MangaFetch] WeebCentral getMangaDetails failed for ${id}:`, err);
      }
    }

    // 4. Smart Cross-Source Failover: if primary source failed, search the other 2 sources by title!
    const queryTitle = (fallbackTitle || deriveTitleFromMangaId(id)).trim();
    if (queryTitle) {
      const altSearches: Promise<MangaItem[]>[] = [];
      if (primarySource !== "weebcentral") altSearches.push(searchWeebCentralDirect(queryTitle, 6));
      if (primarySource !== "mangakatana") altSearches.push(searchMangaKatana(queryTitle, 6));
      if (primarySource !== "asura") altSearches.push(searchAsura(queryTitle));

      const altResults = await Promise.all(altSearches.map((p) => p.catch(() => [] as MangaItem[])));
      for (const list of altResults) {
        const match = pickBestTitleMatch(list, queryTitle);
        if (match) {
          setInCache(cacheKey, match, 1800);
          return match;
        }
      }
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
 * Fetches chapters for Manga/Manhwa from MangaKatana, Asura Scans, or WeebCentral
 * with automatic cross-source failover if the primary source fails or returns 0 chapters.
 */
export async function getMangaChapters(
  id: string,
  options?: {
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
    title?: string;
  }
): Promise<{ chapters: MangaChapter[]; total: number }> {
  const primarySource = id.startsWith("mk-")
    ? "mangakatana"
    : id.startsWith("asura-")
    ? "asura"
    : "weebcentral";

  let chapters: MangaChapter[] = [];
  if (primarySource === "mangakatana") {
    chapters = await fetchMangaKatanaChapters(id.replace(/^mk-/, ""));
  } else if (primarySource === "asura") {
    chapters = await fetchAsuraChapters(id.replace(/^asura-/, ""));
  } else {
    chapters = await fetchWeebCentralChapters(id);
  }

  if (chapters.length > 0) {
    return { chapters, total: chapters.length };
  }

  // Smart Cross-Source Chapter Failover: primary source returned 0 chapters or failed — try the other 2 sources!
  const cachedDetails = getFromCache<MangaItem>(`details_${id}`);
  const queryTitle = (options?.title || cachedDetails?.title || deriveTitleFromMangaId(id)).trim();

  if (queryTitle) {
    const altTargets: Array<{ source: "weebcentral" | "mangakatana" | "asura"; search: Promise<MangaItem[]> }> = [];
    if (primarySource !== "weebcentral") altTargets.push({ source: "weebcentral", search: searchWeebCentralDirect(queryTitle, 6) });
    if (primarySource !== "mangakatana") altTargets.push({ source: "mangakatana", search: searchMangaKatana(queryTitle, 6) });
    if (primarySource !== "asura") altTargets.push({ source: "asura", search: searchAsura(queryTitle) });

    const searchResults = await Promise.all(
      altTargets.map(async (t) => ({
        source: t.source,
        items: await t.search.catch(() => [] as MangaItem[]),
      }))
    );

    for (const res of searchResults) {
      const match = pickBestTitleMatch(res.items, queryTitle);
      if (!match) continue;
      let altChapters: MangaChapter[] = [];
      if (res.source === "mangakatana") {
        altChapters = await fetchMangaKatanaChapters(match.id.replace(/^mk-/, ""));
      } else if (res.source === "asura") {
        altChapters = await fetchAsuraChapters(match.id.replace(/^asura-/, ""));
      } else {
        altChapters = await fetchWeebCentralChapters(match.id);
      }
      if (altChapters.length > 0) {
        return { chapters: altChapters, total: altChapters.length };
      }
    }
  }

  return { chapters: [], total: 0 };
}

async function fetchWeebCentralChapterPagesDirect(chapterId: string): Promise<ChapterPagesData | null> {
  const rawId = chapterId.replace(/^wc-/, "");
  try {
    let res = await fetchWithTimeout(`${WEEBCENTRAL_BASE}/chapters/${rawId}/images?reading_style=long_strip`, {
      headers: { "HX-Request": "true" },
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
        ...html.matchAll(/https:\/\/(?:temp\.compsci88\.com|scans-hot\.planeptune\.us|cdn\.[^"'\s]+)\/manga\/[^"'\s]+/g),
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
  return null;
}

async function fetchAsuraChapterPagesDirect(chapterId: string): Promise<ChapterPagesData | null> {
  const parts = chapterId.replace(/^asura-/, "").split("---");
  const seriesSlug = parts[0];
  const chapterSlug = parts[1];
  if (!seriesSlug || !chapterSlug) return null;

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

/**
 * Fetches high-res page URLs for a chapter from MangaKatana, Asura Scans, or WeebCentral
 * with automatic symmetrical cross-source failover when the primary source fails.
 */
export async function getChapterPages(
  chapterId: string,
  mangaTitle?: string,
  chapterNumber?: string
): Promise<ChapterPagesData | null> {
  const primarySource = chapterId.startsWith("mkch-")
    ? "mangakatana"
    : chapterId.startsWith("asura-")
    ? "asura"
    : "weebcentral";

  // 1. Try primary source
  if (primarySource === "mangakatana") {
    const pages = await getMangaKatanaChapterPages(chapterId);
    if (pages && pages.pageUrls.length > 0) return pages;
  } else if (primarySource === "asura") {
    const pages = await fetchAsuraChapterPagesDirect(chapterId);
    if (pages && pages.pageUrls.length > 0) return pages;
  } else {
    const pages = await fetchWeebCentralChapterPagesDirect(chapterId);
    if (pages && pages.pageUrls.length > 0) return pages;
  }

  // 2. Smart Cross-Source Chapter Pages Failover: try the other 2 sources by title + chapter number!
  const resolvedTitle = (mangaTitle || deriveTitleFromMangaId(chapterId)).trim();
  const resolvedChapter = (chapterNumber || deriveChapterNumFromId(chapterId)).trim();

  if (resolvedTitle && resolvedChapter) {
    const targetNum = parseFloat(resolvedChapter);
    const matchChapter = (list: MangaChapter[]) =>
      list.find(
        (c) =>
          c.chapterNumber === resolvedChapter ||
          (!Number.isNaN(targetNum) && parseFloat(c.chapterNumber) === targetNum)
      );

    const altSources: Array<"weebcentral" | "mangakatana" | "asura"> = [];
    if (primarySource !== "weebcentral") altSources.push("weebcentral");
    if (primarySource !== "mangakatana") altSources.push("mangakatana");
    if (primarySource !== "asura") altSources.push("asura");

    for (const src of altSources) {
      try {
        const searchList =
          src === "weebcentral"
            ? await searchWeebCentralDirect(resolvedTitle, 5)
            : src === "mangakatana"
            ? await searchMangaKatana(resolvedTitle, 5)
            : await searchAsura(resolvedTitle);

        const match = pickBestTitleMatch(searchList, resolvedTitle);
        if (!match) continue;

        const chList =
          src === "weebcentral"
            ? await fetchWeebCentralChapters(match.id)
            : src === "mangakatana"
            ? await fetchMangaKatanaChapters(match.id.replace(/^mk-/, ""))
            : await fetchAsuraChapters(match.id.replace(/^asura-/, ""));

        const ch = matchChapter(chList);
        if (!ch) continue;

        const altPages =
          src === "weebcentral"
            ? await fetchWeebCentralChapterPagesDirect(ch.id)
            : src === "mangakatana"
            ? await getMangaKatanaChapterPages(ch.id)
            : await fetchAsuraChapterPagesDirect(ch.id);

        if (altPages && altPages.pageUrls.length > 0) {
          return {
            ...altPages,
            chapterNumber: resolvedChapter,
          };
        }
      } catch (e) {
        console.warn(`[MangaFetch] ${src} chapter pages fallback failed:`, e);
      }
    }
  }

  return null;
}
