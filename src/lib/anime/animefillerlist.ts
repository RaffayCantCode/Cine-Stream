export interface FillerLookup {
  filler: Set<number>;
  mixed: Set<number>;
  animeCanon: Set<number>;
  mangaCanon: Set<number>;
}

const ANIME_FILLER_LIST_BASE = "https://www.animefillerlist.com/shows";

let masterShowMap: Map<string, string> | null = null;
let masterMapFetchedAt = 0;
const MASTER_MAP_TTL = 24 * 60 * 60 * 1000; // 24h

const pageCache = new Map<string, { lookup: FillerLookup | null; expires: number }>();
const PAGE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export function clearAnimeFillerListCache(): void {
  masterShowMap = null;
  masterMapFetchedAt = 0;
  pageCache.clear();
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function normalizeTitleForFiller(str: string): string {
  return decodeHtmlEntities(str)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(tv|ona|ova|special|movie)\b/gi, " ")
    .replace(/\b(part|cour)\s+\d+\b/gi, " ")
    .replace(/\bseason\s+\d+\b/gi, " ")
    .replace(/\b\d+(st|nd|rd|th)\s+season\b/gi, " ")
    .replace(/\bfinal\s+season\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeFillerSlugPart(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(tv|ona|ova|special|movie)\b/gi, " ")
    .replace(/\b(part|cour)\s+\d+\b/gi, " ")
    .replace(/\bseason\s+\d+\b/gi, " ")
    .replace(/\b\d+(st|nd|rd|th)\s+season\b/gi, " ")
    .replace(/\bfinal\s+season\b/gi, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getMasterShowMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (masterShowMap && now - masterMapFetchedAt < MASTER_MAP_TTL) {
    return masterShowMap;
  }

  const map = new Map<string, string>();
  try {
    const res = await fetch(ANIME_FILLER_LIST_BASE, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "CineStream/1.0" },
      next: { revalidate: 86400 } as any,
    });
    if (!res.ok) return masterShowMap || map;
    const html = await res.text();

    const linkRegex = /<a\b[^>]*href=["']\/shows\/([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    const rawList: { slug: string; titleText: string }[] = [];
    while ((match = linkRegex.exec(html))) {
      const slug = match[1];
      const titleText = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, "").trim());
      if (!slug || !titleText) continue;
      if (slug.endsWith("-definitive-filler-list") || slug.endsWith("-manga-canon")) continue;
      rawList.push({ slug, titleText });
    }

    // 1st Pass: Add exact main titles
    for (const { slug, titleText } of rawList) {
      const parenMatch = titleText.match(/^(.*?)\s*\((.*?)\)$/);
      const mainTitle = parenMatch ? parenMatch[1] : titleText;
      const normMain = normalizeTitleForFiller(mainTitle);
      if (normMain && !map.has(normMain)) {
        map.set(normMain, slug);
      }
    }

    // 2nd Pass: Add secondary parenthetical aliases only if key doesn't exist
    for (const { slug, titleText } of rawList) {
      const parenMatch = titleText.match(/^(.*?)\s*\((.*?)\)$/);
      if (parenMatch) {
        const normSub = normalizeTitleForFiller(parenMatch[2]);
        if (normSub && !map.has(normSub)) {
          map.set(normSub, slug);
        }
      }
    }

    masterShowMap = map;
    masterMapFetchedAt = now;
  } catch (e) {
    console.warn("[AnimeFillerList] Failed to load master show index:", e);
  }
  return masterShowMap || map;
}

export function buildAnimeFillerListSlugCandidates(animeName: string): string[] {
  const raw = animeName.trim();
  const candidates = new Set<string>();

  const add = (value: string) => {
    const slug = normalizeFillerSlugPart(value);
    if (slug.length >= 3) candidates.add(slug);
  };

  add(raw);

  const splitBase = raw.split(/\s*[:|-]\s*/)[0];
  if (splitBase && splitBase !== raw) add(splitBase);

  add(raw.replace(/\bshippuuden\b/i, "shippuden"));
  add(raw.replace(/\bboruto:\s*/i, "boruto-"));

  return Array.from(candidates).slice(0, 5);
}

function parseRanges(str: string, set: Set<number>) {
  if (!str) return;
  const parts = str.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          set.add(i);
        }
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        set.add(num);
      }
    }
  }
}

export function parseAnimeFillerListHtml(html: string): FillerLookup {
  const filler = new Set<number>();
  const mixed = new Set<number>();
  const animeCanon = new Set<number>();
  const mangaCanon = new Set<number>();

  // 1. Parse #Condensed section
  const condensedMatch =
    html.match(/<div\b[^>]*id=["']Condensed["'][^>]*>([\s\S]*?)<\/div>\s*<div\b/i) ||
    html.match(/<div\b[^>]*id=["']Condensed["'][^>]*>([\s\S]*?)<\/div>/i);
  if (condensedMatch) {
    const condensedHtml = condensedMatch[1];

    const mangaMatch = condensedHtml.match(/<div\b[^>]*class=["'][^"']*\bmanga_canon\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (mangaMatch) {
      const text = mangaMatch[1].replace(/<[^>]+>/g, " ");
      parseRanges(text.replace(/^.*?:/, ""), mangaCanon);
    }

    const mixedMatch = condensedHtml.match(/<div\b[^>]*class=["'][^"']*\bmixed_canon\/filler\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (mixedMatch) {
      const text = mixedMatch[1].replace(/<[^>]+>/g, " ");
      parseRanges(text.replace(/^.*?:/, ""), mixed);
    }

    const fillerMatch = condensedHtml.match(/<div\b[^>]*class=["'][^"']*\bfiller\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (fillerMatch) {
      const text = fillerMatch[1].replace(/<[^>]+>/g, " ");
      parseRanges(text.replace(/^.*?:/, ""), filler);
    }

    const animeCanonMatch = condensedHtml.match(/<div\b[^>]*class=["'][^"']*\banime_canon\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (animeCanonMatch) {
      const text = animeCanonMatch[1].replace(/<[^>]+>/g, " ");
      parseRanges(text.replace(/^.*?:/, ""), animeCanon);
    }
  }

  // 2. Parse table rows as backup/reinforcement
  const rowRegex = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html))) {
    const attrs = rowMatch[1] || "";
    const body = rowMatch[2] || "";
    const classMatch = attrs.match(/class=["']([^"']+)["']/i);
    const rowClass = (classMatch?.[1] || "").toLowerCase();
    if (!rowClass) continue;

    const numberMatch =
      body.match(/<td\b[^>]*class=["'][^"']*\bNumber\b[^"']*["'][^>]*>\s*(\d+)\s*<\/td>/i) ||
      body.match(/<td\b[^>]*>\s*(\d+)\s*<\/td>/i);
    const episodeNum = numberMatch ? parseInt(numberMatch[1], 10) : NaN;
    if (!episodeNum || Number.isNaN(episodeNum)) continue;

    if (rowClass.includes("mixed_canon/filler")) mixed.add(episodeNum);
    else if (rowClass.includes("filler")) filler.add(episodeNum);
    else if (rowClass.includes("anime_canon")) animeCanon.add(episodeNum);
    else if (rowClass.includes("manga_canon")) mangaCanon.add(episodeNum);
  }

  return { filler, mixed, animeCanon, mangaCanon };
}

export async function fetchFillerLookupFromAnimeFillerList(
  ...animeNames: (string | null | undefined)[]
): Promise<FillerLookup | null> {
  const validNames = animeNames.filter((n): n is string => Boolean(n && n.trim().length > 0));
  if (validNames.length === 0) return null;

  // Try master map first
  const map = await getMasterShowMap();
  let matchedSlug: string | null = null;
  for (const name of validNames) {
    const norm = normalizeTitleForFiller(name);
    if (map.has(norm)) {
      matchedSlug = map.get(norm)!;
      break;
    }
  }

  const slugsToTry: string[] = [];
  if (matchedSlug) slugsToTry.push(matchedSlug);

  for (const name of validNames) {
    for (const cand of buildAnimeFillerListSlugCandidates(name)) {
      if (!slugsToTry.includes(cand)) slugsToTry.push(cand);
    }
  }

  const now = Date.now();
  for (const slug of slugsToTry) {
    const cacheHit = pageCache.get(slug);
    if (cacheHit && cacheHit.expires > now) {
      if (cacheHit.lookup) return cacheHit.lookup;
      continue;
    }

    try {
      const res = await fetch(`${ANIME_FILLER_LIST_BASE}/${slug}`, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "CineStream/1.0" },
        next: { revalidate: 86400 } as any,
      });

      if (!res.ok) {
        pageCache.set(slug, { lookup: null, expires: now + 3600000 }); // cache 404 for 1h
        continue;
      }

      const lookup = parseAnimeFillerListHtml(await res.text());
      if (lookup.filler.size > 0 || lookup.mixed.size > 0 || lookup.mangaCanon.size > 0 || lookup.animeCanon.size > 0) {
        pageCache.set(slug, { lookup, expires: now + PAGE_CACHE_TTL });
        return lookup;
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

export function isEpisodeFiller(
  lookup: FillerLookup | null | undefined,
  episodeNum: number,
  episodeOffset: number = 0
): boolean {
  if (!lookup) return false;
  const targetNum = episodeNum;
  const globalNum = episodeNum + episodeOffset;
  return (
    lookup.filler.has(targetNum) ||
    lookup.filler.has(globalNum)
  );
}
