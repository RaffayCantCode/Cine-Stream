// Multi-API Anime Fetcher
// Metadata: AniList (primary) + Jikan (fallback)
// Streaming: iframe embed sources only (no HLS)

import { isAdultContent } from "./content-filter";
import { tmdbFetch, searchTmdbShow, fetchTmdbEpisodeData, getCleanBaseTitle } from "./tmdb";

export interface AnimeItem {
  id: string;
  idMal?: string | null;
  isAdult?: boolean;
  name: string;
  jname?: string | null;
  poster: string;
  type?: string | null;
  episodes?: { sub: number | null; dub: number | null };
  rating?: string | null;
  description?: string;
  genres?: string[];
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  duration?: number | null;
  trailerId?: string | null;
}

export interface SeasonInfo {
  id: string;
  name: string;
  seasonLabel: string;
  totalEpisodes: number;
  isCurrent: boolean;
  idMal?: number | null;
  seasonYear?: number | null;
  tmdbSeasonNumber?: number | null;
  tmdbId?: number | null;
  episodeOffset?: number;
  coverImage?: string | null;
  bannerImage?: string | null;
}

export interface EpisodeDetail {
  episodeId: string;
  episodeNum: number;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  releasedDate?: string | null;
  isFiller?: boolean;
  isRecap?: boolean;
  malUrl?: string | null;
  seasonNum?: number;
  seasonId?: string;
  seasonName?: string;
  seasonMalId?: number | null;
  runtime?: number | null;
}

interface AniListMedia {
  id: number;
  idMal: number | null;
  isAdult?: boolean;
  title: { romaji: string; english: string | null; native: string | null };
  coverImage: { large: string; extraLarge: string };
  episodes: number | null;
  genres: string[];
  averageScore: number | null;
  description: string | null;
  status: string | null;
  type: string | null;
  format: string | null;
  season: string | null;
  seasonYear: number | null;
  duration: number | null;
  trailer?: { id: string; site: string } | null;
}

// A node in the franchise graph
interface FranchiseNode {
  id: number;
  idMal: number | null;
  title: string;
  episodes: number | null;
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  duration: number | null;
  coverImage?: string | null;
  bannerImage?: string | null;
}

const ANILIST_API = "https://graphql.anilist.co";
const JIKAN_BASE = "https://api.jikan.moe/v4";
const anilistCache = new Map<string, { data: any; expires: number }>();
const ANILIST_CACHE_TTL = 300000; // 5 minutes

async function anilistQuery(query: string, variables: Record<string, any>, retries = 2): Promise<any> {
  const cacheKey = JSON.stringify({ query, variables });
  const cached = anilistCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(ANILIST_API, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          "User-Agent": "CineStream/1.0 (https://github.com/RaffayCantCode/Cine-Stream)"
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
        next: { revalidate: 86400 } as any,
      });
      
      clearTimeout(timeoutId);

      if (res.status === 429 && attempt < retries) {
        const retryAfter = res.headers.get("retry-after");
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * (attempt + 1);
        if (delay > 3000) {
          throw new Error("AniList rate limited with long delay");
        }
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      if (!res.ok) {
        throw new Error(`AniList returned ${res.status}`);
      }

      const data = await res.json();
      
      // Keep cache size manageable
      if (anilistCache.size > 200) {
        const oldest = anilistCache.keys().next().value;
        if (oldest) anilistCache.delete(oldest);
      }
      anilistCache.set(cacheKey, { data, expires: Date.now() + ANILIST_CACHE_TTL });
      
      return data;
    } catch (e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

function transformAniList(media: AniListMedia): AnimeItem | null {
  if (media.isAdult) return null;
  return {
    id: String(media.id),
    idMal: media.idMal ? String(media.idMal) : null,
    isAdult: media.isAdult || false,
    name: media.title.english || media.title.romaji,
    jname: media.title.native || null,
    poster: media.coverImage?.extraLarge || media.coverImage?.large || "",
    type: media.type || "TV",
    episodes: { sub: media.episodes || null, dub: null },
    rating: media.averageScore ? String(media.averageScore / 10) : null,
    description: media.description?.replace(/<[^>]*>/g, "") || "",
    genres: media.genres || [],
    status: media.status || null,
    season: media.season || null,
    seasonYear: media.seasonYear || null,
    format: media.format || null,
    duration: media.duration || null,
    trailerId: media.trailer?.site === "youtube" ? media.trailer.id : null,
  };
}

const LIST_QUERY = `query ($page: Int, $genre: String, $q: String) {
  Page(page: $page, perPage: 50) {
    media(
      type: ANIME,
      isAdult: false,
      sort: [POPULARITY_DESC],
      genre: $genre,
      search: $q
    ) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear trailer { id site }
    }
  }
}`;

const TRENDING_QUERY = `query ($page: Int, $genre: String) {
  Page(page: $page, perPage: 20) {
    media(
      type: ANIME,
      isAdult: false,
      sort: [TRENDING_DESC, POPULARITY_DESC],
      genre: $genre
    ) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

const AIRING_QUERY = `query ($page: Int, $genre: String, $season: MediaSeason, $year: Int) {
  Page(page: $page, perPage: 50) {
    media(
      type: ANIME,
      isAdult: false,
      sort: [POPULARITY_DESC],
      genre: $genre,
      season: $season,
      seasonYear: $year
    ) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

// AniList relations query — fetches immediate neighbors
const RELATIONS_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal
    title { romaji english }
    episodes season seasonYear format duration
    relations {
      edges {
        node {
          id idMal
          title { romaji english }
          type episodes season seasonYear format duration isAdult
        }
        relationType
      }
    }
  }
}`;

function getCurrentSeason() {
  const now = new Date();
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  return {
    season: seasons[Math.floor(now.getMonth() / 3)],
    year: now.getFullYear(),
  };
}

function filterUnreleased(items: AnimeItem[]): AnimeItem[] {
  return items.filter(item => {
    const s = item.status;
    if (!s) return true;
    // AniList statuses
    if (s === "NOT_YET_RELEASED" || s === "CANCELLED") return false;
    // Jikan statuses
    if (s === "Not yet aired" || s === "Cancelled") return false;
    return true;
  });
}

function deduplicateAnime(items: AnimeItem[]): AnimeItem[] {
  const seen = new Set<string>();
  const seenMal = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    if (item.idMal) {
      if (seenMal.has(item.idMal)) return false;
      seenMal.add(item.idMal);
    }
    return true;
  });
}

// Group anime by franchise — keeps only the first entry per exact normalized title
// Does NOT strip season/part markers to prevent merging different entries
function groupByFranchise(items: AnimeItem[]): AnimeItem[] {
  const grouped = new Map<string, AnimeItem>();
  for (const item of items) {
    const normalized = item.name
      .replace(/\s*\(tv\)\s*$/i, '')
      .replace(/\s*\(.*?\)\s*$/g, '')
      .replace(/:$/, '')
      .trim()
      .toLowerCase();
    if (!grouped.has(normalized)) {
      grouped.set(normalized, item);
    } else {
      const existing = grouped.get(normalized)!;
      if (!existing.idMal && item.idMal) {
        grouped.set(normalized, item);
      }
    }
  }
  return [...grouped.values()];
}

function transformJikan(a: any): AnimeItem {
  return {
    id: String(a.mal_id),
    idMal: String(a.mal_id),
    isAdult: a.rating === "Rx - Hentai",
    name: a.title_english || a.title,
    jname: a.title_japanese || null,
    poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "",
    type: a.type || "TV",
    episodes: { sub: a.episodes || null, dub: null },
    rating: a.score ? String(a.score) : null,
    description: a.synopsis || "",
    genres: a.genres?.map((g: any) => g.name) || [],
    status: a.status || null,
    season: a.season || null,
    seasonYear: a.year || null,
    format: a.type || null,
    duration: a.duration ? parseInt(a.duration) : null,
    trailerId: a.trailer?.youtube_id || null,
  };
}

export async function searchAnime(q: string, page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(LIST_QUERY, { page, q, genre: genre || null });
    if (data?.data?.Page?.media) {
      return filterUnreleased(deduplicateAnime((data.data.Page.media).map(transformAniList).filter(Boolean) as AnimeItem[]));
    }
  } catch (e) {
    console.warn("AniList search failed, falling back to Jikan:", e);
  }
  
  // Jikan fallback
  const res = await fetch(`${JIKAN_BASE}/anime?q=${encodeURIComponent(q)}&page=${page}${genre ? `&genres=${genre}` : ""}`);
  const data = await res.json();
  return filterUnreleased(deduplicateAnime((data.data || []).map(transformJikan)));
}

export async function getPopularAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(LIST_QUERY, { page, genre: genre || null, q: null });
    if (data?.data?.Page?.media) {
      return filterUnreleased(deduplicateAnime((data.data.Page.media).map(transformAniList).filter(Boolean) as AnimeItem[]));
    }
  } catch (e) {
    console.warn("AniList popular failed, falling back to Jikan:", e);
  }

  const res = await fetch(`${JIKAN_BASE}/top/anime?filter=bypopularity&page=${page}`);
  const data = await res.json();
  return filterUnreleased(deduplicateAnime((data.data || []).map(transformJikan)));
}

export async function getTrendingAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(TRENDING_QUERY, { page, genre: genre || null });
    if (data?.data?.Page?.media) {
      return filterUnreleased(deduplicateAnime((data.data.Page.media).map(transformAniList).filter(Boolean) as AnimeItem[]));
    }
  } catch (e) {
    console.warn("AniList trending failed, falling back to Jikan:", e);
  }

  const res = await fetch(`${JIKAN_BASE}/top/anime?filter=airing&page=${page}`);
  const data = await res.json();
  return filterUnreleased(deduplicateAnime((data.data || []).map(transformJikan)));
}

export async function getAiringAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const { season, year } = getCurrentSeason();
    const data = await anilistQuery(AIRING_QUERY, { page, genre: genre || null, season, year });
    if (data?.data?.Page?.media) {
      return filterUnreleased(deduplicateAnime((data.data.Page.media).map(transformAniList).filter(Boolean) as AnimeItem[]));
    }
  } catch (e) {
    console.warn("AniList airing failed, falling back to Jikan:", e);
  }

  const res = await fetch(`${JIKAN_BASE}/seasons/now?page=${page}`);
  const data = await res.json();
  return filterUnreleased(deduplicateAnime((data.data || []).map(transformJikan)));
}

// ─────────────────────────────────────────────────────────────────────────────
// FRANCHISE GRAPH TRAVERSAL
// ─────────────────────────────────────────────────────────────────────────────

// Relation types that constitute the same franchise
const FRANCHISE_RELATION_TYPES = new Set(["SEQUEL", "PREQUEL", "ALTERNATIVE", "PARENT"]);
// These formats get included in the season list
const INCLUDABLE_FORMATS = new Set(["TV", "TV_SHORT", "OVA", "ONA", "SPECIAL", "MOVIE"]);

const RELATIONS_SINGLE_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal title { romaji english native } episodes season seasonYear format duration bannerImage coverImage { large extraLarge }
    relations {
      edges { relationType node { id idMal title { romaji english native } episodes season seasonYear format duration type isAdult bannerImage coverImage { large extraLarge } } }
    }
  }
}`;

async function buildFranchiseGraph(startId: number): Promise<FranchiseNode[]> {
  const visited = new Map<number, FranchiseNode>(); // id → node
  const queue: number[] = [startId];
  const MAX_NODES = 150; // Increased safety cap for large franchises like MHA
  const MAX_HOPS = 15; // Increased max hops for deep franchises like AOT and MHA
  let hops = 0;

  while (queue.length > 0 && visited.size < MAX_NODES && hops < MAX_HOPS) {
    // Process all queued nodes in one single bulk request!
    const batch = queue.splice(0, queue.length);
    hops++;
    try {
      const medias = (await Promise.all(
        batch.map(async (nodeId) => {
          try {
            const result = await anilistQuery(RELATIONS_SINGLE_QUERY, { id: nodeId });
            return result?.data?.Media || null;
          } catch (e) {
            console.warn(`Failed to fetch relations for ${nodeId}`, e);
            return null;
          }
        })
      )).filter(Boolean);

      for (const data of medias) {
        if (!data) continue;

        const nodeId = data.id as number;
        if (!visited.has(nodeId)) {
          visited.set(nodeId, {
            id: nodeId,
            idMal: data.idMal || null,
            title: data.title?.english || data.title?.romaji || data.title?.native || "",
            episodes: data.episodes || null,
            season: data.season || null,
            seasonYear: data.seasonYear || null,
            format: data.format || null,
            duration: data.duration || null,
            coverImage: data.coverImage?.extraLarge || data.coverImage?.large || null,
            bannerImage: data.bannerImage || null,
          });
        }

        // Traverse edges
        const edges = data.relations?.edges || [];
        for (const edge of edges) {
          const node = edge.node;
          const relType: string = edge.relationType || "";
          if (
            !FRANCHISE_RELATION_TYPES.has(relType) ||
            node.type !== "ANIME" ||
            node.isAdult
          ) continue;

          const neighborId = node.id as number;
          if (!visited.has(neighborId)) {
            // Pre-add to visited immediately (with data we already have) to prevent duplicates
            visited.set(neighborId, {
              id: neighborId,
              idMal: node.idMal || null,
              title: node.title?.english || node.title?.romaji || node.title?.native || "",
              episodes: node.episodes || null,
              season: node.season || null,
              seasonYear: node.seasonYear || null,
              format: node.format || null,
              duration: node.duration || null,
              coverImage: node.coverImage?.extraLarge || node.coverImage?.large || null,
              bannerImage: node.bannerImage || null,
            });
            // Also queue it so we fetch its own relations (to continue the chain)
            if (visited.size < MAX_NODES) {
              queue.push(neighborId);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Bulk query failed:", e);
    }

    // Small delay between hops to be nice to AniList rate limits
    if (queue.length > 0 && hops > 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Filter out nodes with no title (partial/failed AniList responses)
  return [...visited.values()].filter(n => n.title);
}

/**
 * From the franchise graph, find the "root" — the earliest TV entry chronologically.
 * If there are no TV entries, fall back to the first entry by year.
 */
function findFranchiseRoot(nodes: FranchiseNode[]): FranchiseNode | null {
  if (nodes.length === 0) return null;

  const seasonOrder = ["WINTER", "SPRING", "SUMMER", "FALL"];

  // Prefer TV/TV_SHORT entries with the earliest air date
  const tvNodes = nodes.filter(n => n.format === "TV" || n.format === "TV_SHORT");
  const candidates = tvNodes.length > 0 ? tvNodes : nodes;

  return candidates.sort((a, b) => {
    const yearA = a.seasonYear || 9999;
    const yearB = b.seasonYear || 9999;
    if (yearA !== yearB) return yearA - yearB;
    const seasonA = seasonOrder.indexOf(a.season || "FALL");
    const seasonB = seasonOrder.indexOf(b.season || "FALL");
    return seasonA - seasonB;
  })[0] || null;
}

/**
 * Sort and label all franchise nodes into a clean SeasonInfo list.
 * TV entries → "Season N"
 * OVA/ONA → "OVA N"
 * Special → "Special N"
 * Movie → "Movie N"
 */
function buildSeasonList(nodes: FranchiseNode[], currentId: number): SeasonInfo[] {
  const seasonOrder = ["WINTER", "SPRING", "SUMMER", "FALL"];

  // Filter to only includable formats with some content
  const includable = nodes.filter(n =>
    n.format && INCLUDABLE_FORMATS.has(n.format)
  );

  // Sort chronologically
  includable.sort((a, b) => {
    const yearA = a.seasonYear || 9999;
    const yearB = b.seasonYear || 9999;
    if (yearA !== yearB) return yearA - yearB;
    // Within same year, sort TV before specials/OVAs
    const formatOrder = { TV: 0, TV_SHORT: 1, ONA: 2, OVA: 3, SPECIAL: 4, MOVIE: 5 };
    const fA = (formatOrder as any)[a.format || "TV"] ?? 6;
    const fB = (formatOrder as any)[b.format || "TV"] ?? 6;
    if (fA !== fB) return fA - fB;
    const sA = seasonOrder.indexOf(a.season || "FALL");
    const sB = seasonOrder.indexOf(b.season || "FALL");
    return sA - sB;
  });

  let tvCount = 0;
  let movieCount = 0;
  let ovaCount = 0;
  let specialCount = 0;

  // ONA entries with 8+ episodes AND a known broadcast season are streaming TV series
  // misclassified by AniList (e.g. Witch Hat Atelier is ONA on AniList but TV on MAL).
  const knownBroadcastSeasons = new Set(["WINTER", "SPRING", "SUMMER", "FALL"]);

  const mappedSeasons = includable.map(node => {
    // Reclassify single-episode movies with short duration (< 40 min) as Specials
    // These are usually compilation/recap films, not actual feature-length movies.
    const isShortMovie = node.format === "MOVIE"
      && (node.episodes || 1) <= 1
      && (node.duration || 0) > 0
      && node.duration! < 40;

    const isMovie = node.format === "MOVIE" && !isShortMovie;
    const isSpecial = node.format === "SPECIAL" || isShortMovie;
    // Only treat as OVA if it's an actual OVA/ONA short collection (< 8 eps) or
    // an ONA without a known broadcast season. Otherwise it's a streaming TV series.
    const isActualOva = node.format === "OVA"
      || (node.format === "ONA" && (
        (node.episodes || 0) < 8
        || !knownBroadcastSeasons.has(node.season || "")
      ));
    const isTv = !isMovie && !isActualOva && !isSpecial;

    let label: string;
    if (isMovie) { movieCount++; label = `Movie ${movieCount}`; }
    else if (isActualOva) { ovaCount++; label = `OVA ${ovaCount}`; }
    else if (isSpecial) { specialCount++; label = `Special ${specialCount}`; }
    else { tvCount++; label = `Season ${tvCount}`; }

    const totalEp = isMovie || isActualOva || isSpecial
      ? Math.max(node.episodes || 1, 1)
      : Math.max(node.episodes || 1500, 1);

    return {
      id: String(node.id),
      name: node.title,
      seasonLabel: label,
      totalEpisodes: totalEp,
      isCurrent: node.id === currentId,
      idMal: node.idMal,
      seasonYear: node.seasonYear,
    };
  });

  return mappedSeasons.filter(season => {
    // Always keep the currently opened season, TV seasons, and Movies
    if (season.isCurrent) return true;
    if (season.seasonLabel.startsWith("Season") || season.seasonLabel.startsWith("Movie")) return true;
    
    // For OVAs and Specials, only keep them if they are likely plot-critical
    const lowerName = season.name.toLowerCase();
    const plotKeywords = ["final", "part", "chapter", "season", "arc", "prologue", "epilogue"];
    if (plotKeywords.some(kw => lowerName.includes(kw))) return true;
    
    return false;
  });
}

/**
 * Build season list from TMDB show data.
 * ALL seasons belong to the current anime — no cross-franchise matching.
 * Uses synthetic IDs (tmdb-{tmdbId}-s{num}) to avoid linking to other anime.
 */
function parseSeasonNumberFromTitle(title: string): number {
  const normalized = title.toLowerCase();
  
  const seasonMatch = normalized.match(/season\s*([0-9]+)/);
  if (seasonMatch) return parseInt(seasonMatch[1], 10);

  const romanMatch = normalized.match(/season\s*(i{1,3}|iv|v|vi{1,3}|ix|x)\b/);
  if (romanMatch) {
    const roman = romanMatch[1];
    const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
    return romanMap[roman] || 1;
  }
  
  if (normalized.includes("second season") || normalized.includes("2nd season")) return 2;
  if (normalized.includes("third season") || normalized.includes("3rd season")) return 3;
  if (normalized.includes("fourth season") || normalized.includes("4th season")) return 4;
  if (normalized.includes("fifth season") || normalized.includes("5th season")) return 5;
  if (normalized.includes("sixth season") || normalized.includes("6th season")) return 6;
  if (normalized.includes("seventh season") || normalized.includes("7th season")) return 7;
  if (normalized.includes("eighth season") || normalized.includes("8th season")) return 8;
  if (normalized.includes("ninth season") || normalized.includes("9th season")) return 9;
  if (normalized.includes("tenth season") || normalized.includes("10th season")) return 10;
  // For titles with "final season", try to find an explicit season number first
  // e.g. "Season 4 Final Season" or "4th Final Season" or "Final Season 4"
  const finalSeasonNum = normalized.match(/(?:season\s*)?(\d+)(?:st|nd|rd|th)?\s+final\s+season/i)
    || normalized.match(/final\s+season\s+(\d+)/i);
  if (finalSeasonNum) return parseInt(finalSeasonNum[1], 10);
  // Default heuristic: most anime with "final season" in the title are on their 4th season
  // (e.g. Attack on Titan, My Hero Academia, Haikyuu, etc.)
  // NOTE: We intentionally do NOT match "final season.*?(\d+)" because it incorrectly
  // captures "2" from "Final Season Part 2", mapping it to TMDB season 2 instead of 4.
  if (normalized.includes("final season")) return 4;
  
  const romanEndMatch = normalized.match(/\s+(ii|iii|iv|v|vi|vii|viii|ix|x)$/);
  if (romanEndMatch) {
    const roman = romanEndMatch[1];
    const romanMap: Record<string, number> = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
    return romanMap[roman] || 1;
  }

  const numEndMatch = normalized.match(/\s+([2-9])$/);
  if (numEndMatch) return parseInt(numEndMatch[1], 10);

  return 1;
}



// ─────────────────────────────────────────────────────────────────────────────
// SERVER-SIDE CACHE
// ─────────────────────────────────────────────────────────────────────────────

const animeDetailCache = new Map<string, { data: any; expires: number }>();
const ANIME_CACHE_MAX = 100;

function getCachedDetail(key: string) {
  const cached = animeDetailCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  animeDetailCache.delete(key);
  return null;
}
function setCachedDetail(key: string, data: any, isDegradedOverride?: boolean) {
  if (animeDetailCache.size >= ANIME_CACHE_MAX) {
    const oldest = animeDetailCache.keys().next();
    if (!oldest.done) animeDetailCache.delete(oldest.value);
  }
  const isDev = process.env.NODE_ENV === "development";
  
  // If data lacks franchise nodes or has explicit override, cache for 1 minute to allow quick recovery
  const isDegraded = isDegradedOverride || !data?.franchiseNodes || data.franchiseNodes.length === 0;
  
  let ttl = 1800000; // 30 min TTL
  if (isDev) ttl = 5000; // 5 sec TTL in dev
  else if (isDegraded) ttl = 60000; // 1 min TTL if degraded
  
  animeDetailCache.set(key, { data, expires: Date.now() + ttl });
}

const INITIAL_EP_LIMIT = 100;

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function validateSeason(
  season: SeasonInfo,
  animeName: string,
  nodes: FranchiseNode[]
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check episode count is reasonable
  if (season.totalEpisodes <= 0) {
    warnings.push(`Season "${season.seasonLabel}" has 0 episodes`);
  }
  if (season.totalEpisodes > 1000) {
    warnings.push(`Season "${season.seasonLabel}" has suspiciously many episodes (${season.totalEpisodes})`);
  }

  // Check season label makes sense given format
  const node = nodes.find(n => n.id === parseInt(season.id, 10));
  if (node) {
    if (node.format === "MOVIE" && !season.seasonLabel.startsWith("Movie")) {
      warnings.push(`Season "${season.seasonLabel}" is a movie but labeled as non-movie`);
    }
    if (node.format === "OVA" && !season.seasonLabel.startsWith("OVA") && !season.seasonLabel.startsWith("Special")) {
      warnings.push(`Season "${season.seasonLabel}" is OVA but labeled differently`);
    }
  }

  return { valid: warnings.length === 0, warnings };
}

function validateEpisode(
  ep: EpisodeDetail,
  season: SeasonInfo,
  allEps: EpisodeDetail[]
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check episode number is within expected range
  if (ep.episodeNum < 1) {
    warnings.push(`Episode ${ep.episodeNum} has invalid number`);
  }
  if (ep.episodeNum > (season.totalEpisodes + 5)) {
    warnings.push(`Episode ${ep.episodeNum} exceeds season total (${season.totalEpisodes})`);
  }

  // Check for duplicate episode numbers
  const sameNum = allEps.filter(e => e.episodeNum === ep.episodeNum);
  if (sameNum.length > 1) {
    warnings.push(`Duplicate episode number ${ep.episodeNum} in season "${season.seasonLabel}"`);
  }

  return { valid: warnings.length === 0, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DETAIL FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch full anime franchise details for any season ID.
 * - Builds the complete franchise graph via BFS
 * - Always returns ALL seasons, OVAs, movies, specials
 * - openedSeasonId: the originally-requested AniList ID (for pre-selecting the tab)
 */
export async function getAnimeDetails(
  id: string,
  epLimit = INITIAL_EP_LIMIT,
  skipEpisodes = false
): Promise<{
  anime: AnimeItem;
  episodes: EpisodeDetail[];
  totalEpisodes: number;
  seasons: SeasonInfo[];
  openedSeasonId: string;
  franchiseNodes: FranchiseNode[];
  tmdbId?: number | null;
  tmdbSeasonMap?: Record<string, number>;
} | null> {
  const isMalInput = id.startsWith("mal-");
  const malIdNum = parseInt(id.replace("mal-", ""), 10);
  if (isNaN(malIdNum)) return null;

  let resolvedFromMal = false;
  if (isMalInput) {
    try {
      const q = `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
          id
        }
      }`;
      const res = await anilistQuery(q, { idMal: malIdNum });
      if (res?.data?.Media?.id) {
        id = String(res.data.Media.id);
        resolvedFromMal = true;
      } else {
        id = String(malIdNum);
      }
    } catch {
      id = String(malIdNum);
    }
  }

  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;

  const cacheKey = `independent:${id}:${epLimit}:${skipEpisodes}`;
  const cached = getCachedDetail(cacheKey);
  if (cached) return cached;

  // Step 0: Fetch AniZip mappings for IDs (TMDB & MAL) first
  let aniZipMapping: any = null;
  try {
    const aniZipRes = await fetch(`https://api.ani.zip/mappings?anilist_id=${id}`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 } // Cache mappings for 24h
    });
    if (aniZipRes.ok) {
      aniZipMapping = await aniZipRes.json();
    }
  } catch { /* ignore */ }

  // Step 1: Fetch main media metadata for the requested ID
  let media: any = null;
  if (!isMalInput || resolvedFromMal) {
    try {
      const q = `query ($id: Int) {
        Media(id: $id, type: ANIME, isAdult: false) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear duration trailer { id site }
        }
      }`;
      const data = await anilistQuery(q, { id: numId });
      media = data?.data?.Media;
    } catch {
      // AniList failed — try Tatakai fallback
      try {
        const tRes = await fetch(`https://api.tatakai.me/meta/anilist/info/${numId}?provider=zoro`, { signal: AbortSignal.timeout(6000) });
        if (tRes.ok) {
          const tData = await tRes.json();
          if (tData) {
            media = {
              id: tData.id,
              idMal: tData.malId || null,
              isAdult: false,
              title: {
                romaji: tData.title?.romaji,
                english: tData.title?.english,
                native: tData.title?.native,
              },
              coverImage: {
                large: tData.image,
                extraLarge: tData.cover || tData.image,
              },
              episodes: tData.totalEpisodes,
              genres: tData.genres || [],
              averageScore: tData.rating || null,
              description: tData.description || "",
              status: tData.status || null,
              type: tData.type || "TV",
              format: tData.type || "TV",
              season: tData.season || null,
              seasonYear: tData.releaseDate || null,
              duration: tData.duration || null,
            };
          }
        }
      } catch {
        // Fallthrough to Jikan
      }
    }
  }

  // Jikan fallback for the main metadata (use ONLY if we have valid MAL ID)
  if (!media) {
    try {
      const resolvedMalId = aniZipMapping?.mappings?.mal_id
        ? String(aniZipMapping.mappings.mal_id)
        : null;
      const targetMalId = resolvedMalId || numId;

      const jikanRes = await fetch(
        `${JIKAN_BASE}/anime/${targetMalId}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (jikanRes.ok) {
        const jData = await jikanRes.json();
        const a = jData.data;
        if (a && a.rating !== "rx") {
          const totalEps = Math.max(a.episodes || (a.status?.includes("Airing") ? 1500 : 12), 1);
          let episodes: EpisodeDetail[] = [];
          if (!skipEpisodes) {
            const realEps = await fetchEpisodesFromJikan(a.mal_id, String(id), Math.min(totalEps, epLimit));
            if (realEps) episodes = realEps;
          }
          const existingNums = new Set(episodes.map(e => e.episodeNum));
          for (let i = 1; i <= Math.min(totalEps, epLimit); i++) {
            if (!existingNums.has(i)) {
              episodes.push({
                episodeId: `${id}-${i}`, episodeNum: i, title: `Episode ${i}`,
                description: null, thumbnail: null, malUrl: null,
                releasedDate: null, isFiller: false, isRecap: false,
                seasonNum: 1, seasonId: id, seasonName: a.title_english || a.title,
                seasonMalId: a.mal_id,
              });
            }
          }
          episodes.sort((a, b) => a.episodeNum - b.episodeNum);
          const animeItem: AnimeItem = {
            id: String(id),
            idMal: String(a.mal_id),
            name: a.title_english || a.title || "Unknown",
            jname: a.title_japanese || null,
            poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "",
            type: a.type || "TV", episodes: { sub: a.episodes || null, dub: null },
            rating: a.score ? String(a.score) : null, description: a.synopsis || "",
            genres: a.genres?.map((g: any) => g.name) || [],
            status: a.status || null, season: a.season || null,
            seasonYear: a.year || null, format: a.type || null,
          };
          const jikanSeason: SeasonInfo = {
            id: String(id), name: animeItem.name,
            seasonLabel: "Episodes", totalEpisodes: totalEps,
            isCurrent: true, idMal: a.mal_id,
          };

          // Try to get TMDB ID via AniZip or fallback search
          let tmdbId: number | null = null;
          if (aniZipMapping?.mappings?.themoviedb_id) {
            tmdbId = parseInt(aniZipMapping.mappings.themoviedb_id, 10);
            if (isNaN(tmdbId)) tmdbId = null;
          }
          if (!tmdbId) {
            try {
              tmdbId = await searchTmdbShow(animeItem.name, animeItem.seasonYear || undefined);
            } catch {
              tmdbId = null;
            }
          }

          let tmdbSeasonMap: Record<string, number> | undefined = undefined;
          let seasonsList: SeasonInfo[] = [jikanSeason];

          if (tmdbId) {
            try {
              const tmdbData = await tmdbFetch(`/tv/${tmdbId}`) as { seasons?: { season_number: number }[] };
              const tmdbSeasons = tmdbData?.seasons || [];
              let tmdbSeasonNum = 1;
              
              if (aniZipMapping?.episodes?.["1"]?.tmdbSeason) {
                tmdbSeasonNum = aniZipMapping.episodes["1"].tmdbSeason;
              } else {
                const matched = tmdbSeasons.find((s: any) => {
                  if (!s.air_date) return false;
                  const year = animeItem.seasonYear?.toString();
                  return year ? s.air_date.startsWith(year) : false;
                }) || tmdbSeasons.find((s: any) => s.season_number > 0);
                tmdbSeasonNum = matched?.season_number || 1;
              }
              
              jikanSeason.tmdbSeasonNumber = tmdbSeasonNum;
              jikanSeason.tmdbId = tmdbId;
              tmdbSeasonMap = { [String(id)]: tmdbSeasonNum };
            } catch { /* ignore */ }
          }

          const val = validateSeason(seasonsList.find(s => s.id === String(id)) || seasonsList[0] || jikanSeason, animeItem.name, []);
          if (val.warnings.length > 0) {
            console.warn(`[Validation] Jikan fallback season warnings for ${id}:`, val.warnings);
          }
          const jikanResult = {
            anime: animeItem, episodes, totalEpisodes: totalEps,
            seasons: seasonsList, openedSeasonId: id,
            franchiseNodes: [] as FranchiseNode[],
            tmdbId,
            tmdbSeasonMap,
          };
          setCachedDetail(cacheKey, jikanResult);
          return jikanResult;
        }
      }
    } catch { /* no fallback */ }
    return null;
  }

  const anime = transformAniList(media);
  if (!anime) return null;

  // Step 2: Build the franchise graph to find all related entries (for the Season Guide dropdown)
  let franchiseNodes: FranchiseNode[] = await buildFranchiseGraph(numId);
  
  if (franchiseNodes && franchiseNodes.length > 0) {
    const seasonOrder = ["WINTER", "SPRING", "SUMMER", "FALL"];
    
    // Filter out the 3 unrelated/redundant Fate movies/OVAs
    const EXCLUDED_IDS = new Set([6922, 19165, 12565]);
    franchiseNodes = franchiseNodes.filter(n => !EXCLUDED_IDS.has(Number(n.id)));

    franchiseNodes.sort((a, b) => {
      // Custom chronological order for the Fate series
      const FATE_ORDER = [10087, 11741, 356, 19603, 20792, 20791, 21718, 21719];
      const idxA = FATE_ORDER.indexOf(Number(a.id));
      const idxB = FATE_ORDER.indexOf(Number(b.id));
      
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;

      const yearA = a.seasonYear || 9999;
      const yearB = b.seasonYear || 9999;
      if (yearA !== yearB) return yearA - yearB;
      const formatOrder = { TV: 0, TV_SHORT: 1, ONA: 2, OVA: 3, SPECIAL: 4, MOVIE: 5 };
      const fA = (formatOrder as any)[a.format || "TV"] ?? 6;
      const fB = (formatOrder as any)[b.format || "TV"] ?? 6;
      if (fA !== fB) return fA - fB;
      const sA = seasonOrder.indexOf(a.season || "FALL");
      const sB = seasonOrder.indexOf(b.season || "FALL");
      return sA - sB;
    });

    franchiseNodes = franchiseNodes.filter(node => {
      if (node.id === numId) return true;
      if (node.format === "TV" || node.format === "MOVIE" || node.format === "ONA") return true;
      
      const lowerName = (node.title || "").toLowerCase();
      const plotKeywords = ["final", "part", "chapter", "season", "arc", "prologue", "epilogue", "movie"];
      if (plotKeywords.some(kw => lowerName.includes(kw))) return true;
      
      return false;
    });
  }
  
  if (!franchiseNodes || franchiseNodes.length === 0) {
    let aniZipCount = null;
    if (aniZipMapping?.episodes) {
      const keys = Object.keys(aniZipMapping.episodes).map(Number).filter(n => !isNaN(n));
      if (keys.length > 0) aniZipCount = Math.max(...keys);
    }
    franchiseNodes = [{
      id: numId,
      idMal: media.idMal || null,
      title: anime.name,
      episodes: media.episodes || aniZipCount || null,
      season: media.season || null,
      seasonYear: media.seasonYear || null,
      format: media.format || null,
      duration: media.duration || null,
    }];
  }

  // Step 2.5: Search TMDB for the anime to use as primary season structure
  let tmdbId: number | null = null;
  let tmdbSeasonMap: Record<string, number> = {};

  if (aniZipMapping?.mappings?.themoviedb_id) {
    tmdbId = parseInt(aniZipMapping.mappings.themoviedb_id, 10);
    if (isNaN(tmdbId)) tmdbId = null;
  }

  if (!tmdbId) {
    try {
      tmdbId = await searchTmdbShow(anime.name, anime.seasonYear || undefined);
      if (!tmdbId && anime.jname) {
        tmdbId = await searchTmdbShow(anime.jname, anime.seasonYear || undefined);
      }
    } catch {
      tmdbId = null;
    }
  }

  // Step 3: Build season list from the AniList franchise graph
  const baseSeasons = buildSeasonList(franchiseNodes, numId);
  const mappedSeasons: SeasonInfo[] = [];
  const uniqueTmdbIds = new Set<number>();
  
  // Also, add ALL franchise nodes as independent seasons in the Season Guide.
  // We don't map them here to episodes, we just use them for navigation.
  
  // Resolve TMDB show IDs for each AniList season in parallel
  const tmdbIds: Record<string, number | null> = {};
  const allAniZipMappings: Record<string, any> = {};
  let hasFailedAniZip = false;
  
  await Promise.all(
    baseSeasons.map(async (s) => {
      try {
        let tid: number | null = null;
        if (String(s.id) === id) {
          tid = tmdbId;
          allAniZipMappings[s.id] = aniZipMapping;
          if (!aniZipMapping) hasFailedAniZip = true;
        } else {
          try {
            const azRes = await fetch(`https://api.ani.zip/mappings?anilist_id=${s.id}`, {
              signal: AbortSignal.timeout(3000),
              next: { revalidate: 86400 }
            });
            if (azRes.ok) {
              const azData = await azRes.json();
              allAniZipMappings[s.id] = azData;
              if (azData.mappings?.themoviedb_id) {
                tid = parseInt(azData.mappings.themoviedb_id, 10);
                if (isNaN(tid)) tid = tmdbId;
              } else {
                tid = tmdbId;
              }
            } else {
              tid = tmdbId;
            }
          } catch {
            tid = tmdbId;
            hasFailedAniZip = true;
          }
        }
        tmdbIds[s.id] = tid;
        if (tid) uniqueTmdbIds.add(tid);
      } catch {
        tmdbIds[s.id] = null;
        hasFailedAniZip = true;
      }
    })
  );

  // Fetch TMDB seasons for each unique TMDB ID in parallel
  const showSeasonsMap: Record<number, { season_number: number; episode_count: number }[]> = {};
  await Promise.all(
    Array.from(uniqueTmdbIds).map(async (tid) => {
      try {
        const showData = await tmdbFetch(`/tv/${tid}`) as {
          seasons?: { season_number: number; episode_count: number }[];
        };
        showSeasonsMap[tid] = (showData?.seasons || []).filter(s => s.season_number >= 0 && s.episode_count > 0);
      } catch {
        showSeasonsMap[tid] = [];
      }
    })
  );

  // Group and map each AniList season to its TMDB season number and episodeOffset
  const mappedEpisodesCount: Record<string, number> = {}; // key: "tmdbId-seasonNum" -> total mapped episodes count

  for (const s of baseSeasons) {
    const tid = tmdbIds[s.id];
    let tmdbSeasonNum: number | null = null;
    let episodeOffset = 0;

    if (tid) {
      const tmdbSeasons = showSeasonsMap[tid] || [];
      const parsedSeasonNum = parseSeasonNumberFromTitle(s.name);

      const sAniZip = allAniZipMappings[s.id];
      const azEp1 = sAniZip?.episodes?.["1"];
      
      if (azEp1?.seasonNumber !== undefined && azEp1?.episodeNumber !== undefined) {
        tmdbSeasonNum = azEp1.seasonNumber;
        episodeOffset = azEp1.episodeNumber - 1;
        const key = `${tid}-${tmdbSeasonNum}`;
        mappedEpisodesCount[key] = Math.max(mappedEpisodesCount[key] || 0, episodeOffset + s.totalEpisodes);
        tmdbSeasonMap[s.id] = tmdbSeasonNum as number;
      } else {
        // Find the best TMDB season to map to
        let tmdbSeason = tmdbSeasons.find(ts => ts.season_number === parsedSeasonNum);
        if (!tmdbSeason) {
          const candidates = tmdbSeasons.filter(ts => ts.season_number <= parsedSeasonNum && ts.season_number > 0);
          if (candidates.length > 0) {
            tmdbSeason = candidates.sort((a, b) => b.season_number - a.season_number)[0];
          }
        }
        if (!tmdbSeason) {
          tmdbSeason = tmdbSeasons.find(ts => ts.season_number > 0);
        }
        if (!tmdbSeason && tmdbSeasons.length > 0) {
          tmdbSeason = tmdbSeasons[0];
        }

        if (tmdbSeason) {
          tmdbSeasonNum = tmdbSeason.season_number;
          // Calculate offset by looking at franchise node accumulation
          const key = `${tid}-${tmdbSeasonNum}`;
          episodeOffset = mappedEpisodesCount[key] || 0;
          mappedEpisodesCount[key] = episodeOffset + s.totalEpisodes;
          
          // Also populate tmdbSeasonMap for backward compatibility
          tmdbSeasonMap[s.id] = tmdbSeasonNum;
        }
      }
    }

    mappedSeasons.push({
      ...s,
      tmdbId: tid,
      tmdbSeasonNumber: tmdbSeasonNum,
      episodeOffset: episodeOffset,
      coverImage: s.coverImage,
      bannerImage: s.bannerImage,
    });
  }

  // Step 4: Find the opened season (the one matching the requested ID)
  let openedSeasonIndex = mappedSeasons.findIndex(s => String(s.id) === id);
  if (openedSeasonIndex === -1) openedSeasonIndex = 0;
  const openedSeason = mappedSeasons[openedSeasonIndex];
  const activeSeasonId = openedSeason?.id || id;

  // Validate all seasons
  for (const s of mappedSeasons) {
    const val = validateSeason(s, anime.name, franchiseNodes);
    if (val.warnings.length > 0) {
      console.warn(`[Validation] Season warnings for "${s.name}":`, val.warnings);
    }
  }

  // Step 5: If skipEpisodes, generate placeholder episodes for the active season only
  if (skipEpisodes) {
    const basicEpisodes: EpisodeDetail[] = [];
    const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => openedSeason.seasonLabel.startsWith(t));
    const count = isSpecialFormat ? 1 : Math.min(openedSeason.totalEpisodes, epLimit);
    for (let i = 1; i <= count; i++) {
      basicEpisodes.push({
        episodeId: `${activeSeasonId}-${i}`,
        episodeNum: i,
        title: i === 1 && isSpecialFormat ? openedSeason.name : `Episode ${i}`,
        description: null, thumbnail: null, malUrl: null,
        releasedDate: null, isFiller: false, isRecap: false,
        seasonNum: openedSeasonIndex + 1,
        seasonId: activeSeasonId,
        seasonName: openedSeason.name,
        seasonMalId: openedSeason.idMal || null,
      });
    }
    const skipResult = {
      anime,
      episodes: basicEpisodes,
      totalEpisodes: openedSeason.totalEpisodes,
      seasons: mappedSeasons,
      openedSeasonId: activeSeasonId,
      franchiseNodes,
      tmdbId,
      tmdbSeasonMap: Object.keys(tmdbSeasonMap).length > 0 ? tmdbSeasonMap : undefined,
    };
    setCachedDetail(cacheKey, skipResult, hasFailedAniZip);
    return skipResult;
  }

  // Step 6: Fetch real episodes for the active season
  const allCombinedEpisodes: EpisodeDetail[] = [];
  const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => openedSeason.seasonLabel.startsWith(t));
  const maxEp = isSpecialFormat ? Math.max(openedSeason.totalEpisodes, 1) : Math.max(openedSeason.totalEpisodes, 1);
  const seasonCap = Math.min(maxEp, epLimit);
  let seasonEps: EpisodeDetail[] = [];

  let resolvedEps: EpisodeDetail[] | null = null;
  try {
    resolvedEps = await fetchEpisodesFromAniZip(activeSeasonId, seasonCap);
  } catch { /* ignore */ }

  if (resolvedEps && resolvedEps.length > 0) {
    seasonEps = resolvedEps;
  } else if (openedSeason.idMal) {
    const realEps = await fetchEpisodesFromJikan(openedSeason.idMal, activeSeasonId, seasonCap);
    if (realEps) seasonEps = realEps;
  }

  // Fill missing episode numbers with placeholders
  const existingNums = new Set(seasonEps.map(e => e.episodeNum));
  for (let i = 1; i <= seasonCap; i++) {
    if (!existingNums.has(i)) {
      seasonEps.push({
        episodeId: `${activeSeasonId}-${i}`,
        episodeNum: i,
        title: `Episode ${i}`,
        description: null, thumbnail: null, malUrl: null,
        releasedDate: null, isFiller: false, isRecap: false,
      });
    }
  }

  seasonEps.sort((a, b) => a.episodeNum - b.episodeNum);
  seasonEps.forEach(ep => {
    ep.seasonNum = openedSeasonIndex + 1;
    ep.seasonId = activeSeasonId;
    ep.seasonName = openedSeason.name;
    ep.seasonMalId = openedSeason.idMal || null;
  });

  // Validate episodes
  for (const ep of seasonEps) {
    const val = validateEpisode(ep, openedSeason, seasonEps);
    if (val.warnings.length > 0) {
      console.warn(`[Validation] Episode ${ep.episodeNum} warnings:`, val.warnings);
    }
  }

  allCombinedEpisodes.push(...seasonEps);

  const fullResult = {
    anime,
    episodes: allCombinedEpisodes,
    totalEpisodes: allCombinedEpisodes.length,
    seasons: mappedSeasons,
    openedSeasonId: activeSeasonId,
    franchiseNodes,
    tmdbId,
    tmdbSeasonMap: Object.keys(tmdbSeasonMap).length > 0 ? tmdbSeasonMap : undefined,
  };
  setCachedDetail(cacheKey, fullResult, hasFailedAniZip);
  return fullResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH / LISTING APIs
// ─────────────────────────────────────────────────────────────────────────────

// Search via Jikan (fallback)
export async function searchViaJikan(query: string): Promise<AnimeItem[]> {
  try {
    const res = await fetch(
      `${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&limit=25&sfw`,
      { headers: { "User-Agent": "CineStream/1.0" }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((a: any) => ({
      id: "mal-" + String(a.mal_id),
      idMal: String(a.mal_id),
      name: a.title_english || a.title,
      jname: a.title_japanese || null,
      poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "",
      type: a.type || "TV",
      episodes: { sub: a.episodes || null, dub: null },
      rating: a.score ? String(a.score) : null,
      description: a.synopsis || "",
      genres: a.genres?.map((g: any) => g.name) || [],
      status: a.status || null,
    }));
  } catch {
    return [];
  }
}

// Fetch real episode metadata (titles, thumbnails, summaries) from AniZip
export async function fetchEpisodesFromAniZip(
  anilistId: string,
  seasonCap: number
): Promise<EpisodeDetail[] | null> {
  try {
    const res = await fetch(`https://api.ani.zip/mappings?anilist_id=${anilistId}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 } as any,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.episodes) return null;

    const eps: EpisodeDetail[] = [];
    for (const key of Object.keys(json.episodes)) {
      const epNum = parseInt(key, 10);
      if (isNaN(epNum) || epNum > seasonCap) continue;

      const ep = json.episodes[key];
      const title = ep.title?.en || ep.title?.['x-jat'] || ep.title?.ja || `Episode ${epNum}`;
      const description = ep.overview || ep.summary || null;
      const thumbnail = ep.image || null;
      const releasedDate = ep.airDate || ep.airdate || null;
      // AniZip provides duration in seconds; convert to minutes
      const runtime = typeof ep.duration === "number" ? Math.round(ep.duration / 60) : null;

      eps.push({
        episodeId: `${anilistId}-${epNum}`,
        episodeNum: epNum,
        title,
        description,
        thumbnail,
        releasedDate,
        isFiller: false,
        isRecap: false,
        malUrl: ep.malId ? `https://myanimelist.net/anime/${ep.malId}/episode/${epNum}` : null,
        runtime,
      });
    }

    return eps.sort((a, b) => a.episodeNum - b.episodeNum);
  } catch (error) {
    console.error("[AnimeFetch] AniZip fetch failed:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JIKAN EPISODE FETCHING
// ─────────────────────────────────────────────────────────────────────────────

// Fetch real episode metadata (titles, thumbnails, airdates) from Jikan
export async function fetchEpisodesFromJikan(
  malId: number | string,
  anilistId: string,
  maxEpisodes: number
): Promise<EpisodeDetail[] | null> {
  try {
    const allEps: EpisodeDetail[] = [];

    // First request to get total pages
    const firstRes = await fetch(
      `${JIKAN_BASE}/anime/${malId}/episodes?page=1`,
      { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "CineStream/1.0" }, next: { revalidate: 86400 } as any }
    );
    if (!firstRes.ok) return null;
    
    const firstData = await firstRes.json();
    const totalPages = firstData.pagination?.last_visible_page || 1;
    const pageEps = firstData.data || [];
    
    // Parse first page
    for (const ep of pageEps) {
      const epNum = typeof ep.episode === "number" ? ep.episode : ep.mal_id;
      if (!epNum || epNum > maxEpisodes) continue;
      allEps.push({
        episodeId: `${anilistId}-${epNum}`,
        episodeNum: epNum,
        title: ep.title || `Episode ${epNum}`,
        description: ep.synopsis || null,
        thumbnail: ep.images?.jpg?.image_url || null,
        releasedDate: ep.aired || null,
        isFiller: ep.filler || false,
        isRecap: ep.recap || false,
        malUrl: ep.url || null,
      });
    }

    // Fetch remaining pages concurrently with 350ms stagger per request
    if (totalPages > 1 && allEps.length < maxEpisodes) {
      const maxPagesToFetch = Math.min(totalPages, Math.ceil(maxEpisodes / 100));
      const promises = [];
      
      for (let p = 2; p <= maxPagesToFetch; p++) {
        promises.push(
          (async () => {
            try {
              const url = `${JIKAN_BASE}/anime/${malId}/episodes?page=${p}`;
              const options = { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "CineStream/1.0" }, next: { revalidate: 86400 } };
              const res = await fetch(url, options as any);
              
              if (res.status === 429) {
                await new Promise(r => setTimeout(r, 1000 + (p * 350)));
                const retryRes = await fetch(url, options as any);
                if (retryRes.ok) return await retryRes.json();
                return null;
              }
              
              if (res.ok) return await res.json();
            } catch {
              return null;
            }
            return null;
          })()
        );
      }
      
      const results = await Promise.all(promises);
      for (const data of results) {
        if (!data || !data.data) continue;
        for (const ep of data.data) {
          const epNum = typeof ep.episode === "number" ? ep.episode : ep.mal_id;
          if (!epNum || epNum > maxEpisodes) continue;
          allEps.push({
            episodeId: `${anilistId}-${epNum}`,
            episodeNum: epNum,
            title: ep.title || `Episode ${epNum}`,
            description: ep.synopsis || null,
            thumbnail: ep.images?.jpg?.image_url || null,
            releasedDate: ep.aired || null,
            isFiller: ep.filler || false,
            isRecap: ep.recap || false,
            malUrl: ep.url || null,
          });
        }
      }
    }

    allEps.sort((a, b) => a.episodeNum - b.episodeNum);
    return allEps.length > 0 ? allEps : null;
  } catch {
    return null;
  }
}

// Fetch episodes from Jikan starting at a specific page (for lazy-loading more episodes)
export async function fetchEpisodesFromJikanPage(
  malId: number | string,
  anilistId: string,
  startPage: number,
  limit: number
): Promise<EpisodeDetail[]> {
  try {
    const allEps: EpisodeDetail[] = [];
    let page = startPage;
    let hasMore = true;
    let retries = 0;

    while (hasMore && allEps.length < limit) {
      const res = await fetch(
        `${JIKAN_BASE}/anime/${malId}/episodes?page=${page}`,
        { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "CineStream/1.0" }, next: { revalidate: 86400 } as any }
      );
      if (res.status === 429 && retries < 3) {
        retries++;
        await new Promise(r => setTimeout(r, 1500 * retries));
        continue;
      }
      if (!res.ok) break;

      const data = await res.json();
      const pageEps = data.data || [];
      if (pageEps.length === 0) break;

      for (const ep of pageEps) {
        const epNum = typeof ep.episode === "number" ? ep.episode : ep.mal_id;
        if (!epNum) continue;
        allEps.push({
          episodeId: `${anilistId}-${epNum}`,
          episodeNum: epNum,
          title: ep.title || `Episode ${epNum}`,
          description: ep.synopsis || null,
          thumbnail: ep.images?.jpg?.image_url || null,
          releasedDate: ep.aired || null,
          isFiller: ep.filler || false,
          isRecap: ep.recap || false,
          malUrl: ep.url || null,
        });
      }

      const totalPages = data.pagination?.last_visible_page || page;
      hasMore = page < totalPages && allEps.length < limit;
      page++;
      if (hasMore) await new Promise(r => setTimeout(r, 350));
    }

    allEps.sort((a, b) => a.episodeNum - b.episodeNum);
    return allEps;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THUMBNAIL FETCHING
// ─────────────────────────────────────────────────────────────────────────────

// In-memory thumbnail cache (keyed by MAL episode URL) - limited to prevent memory leak
const thumbnailCache = new Map<string, string>();
const THUMBNAIL_CACHE_MAX = 200;

// Scrape a single MAL episode page for an episode screenshot
async function scrapeEpisodeThumbnail(malUrl: string): Promise<string | null> {
  try {
    const res = await fetch(malUrl, {
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (!res.ok) return null;
    const html = await res.text();

    const crMatch = html.match(/https?:\/\/img\d\.ak\.crunchyroll\.com\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/i);
    if (crMatch) return crMatch[0];

    const lazyMatch = html.match(/data-src="([^"]+)"[^>]*width="800"/i);
    if (lazyMatch) return lazyMatch[1];

    const posterMatch = html.match(/poster="([^"]+)"/i);
    if (posterMatch) return posterMatch[1];

    const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (ogMatch) return ogMatch[1];

    return null;
  } catch {
    return null;
  }
}

// Exported: fetch a single episode thumbnail with cache
export async function fetchEpisodeThumbnail(malUrl: string): Promise<string | null> {
  if (thumbnailCache.has(malUrl)) return thumbnailCache.get(malUrl)!;
  const thumb = await scrapeEpisodeThumbnail(malUrl);
  if (thumb) {
    if (thumbnailCache.size >= THUMBNAIL_CACHE_MAX) {
      const oldest = thumbnailCache.keys().next();
      if (!oldest.done) thumbnailCache.delete(oldest.value);
    }
    thumbnailCache.set(malUrl, thumb);
  }
  return thumb;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY fetchAnimeApi (used by main API route)
// ─────────────────────────────────────────────────────────────────────────────

const detailCache = new Map<string, { data: any; expires: number }>();
const listCache = new Map<string, { data: any; expires: number }>();
const API_CACHE_MAX = 150;

function pruneApiCache(cache: Map<string, { data: any; expires: number }>, max: number) {
  if (cache.size <= max) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expires <= now) {
      cache.delete(key);
      if (cache.size <= max) break;
    }
  }
  if (cache.size > max) {
    const iter = cache.keys();
    for (let i = 0; i < cache.size - max; i++) {
      const k = iter.next();
      if (k.done) break;
      cache.delete(k.value);
    }
  }
}

export async function fetchAnimeApi(
  endpoint: string,
  isDetail = false
): Promise<any> {
  const [path, queryString] = endpoint.split("?");
  const params = new URLSearchParams(queryString || "");
  const page = parseInt(params.get("page") || "1", 10);
  const genre = params.get("genre") || undefined;

  const isSearch = path.includes("/search") || path.includes("keyword=");
  const isAiring = path.includes("/airing") || path.includes("/latest") || path.includes("/recent");
  const isTrending = path.includes("/trending");
  const isSeries = path.startsWith("/series/");

  const cacheKey = `api:${endpoint}`;

  if (isDetail || isSeries) {
    const id = path.replace("/series/", "").split("?")[0];
    const cacheKeyDetail = `api:detail:${id}`;
    const cached = detailCache.get(cacheKeyDetail);
    if (cached && cached.expires > Date.now()) return cached.data;

    const result = await getAnimeDetails(id);
    if (result) {
      const response = {
        success: true,
        data: {
          ...result.anime,
          episodes: result.episodes,
          totalEpisodes: result.totalEpisodes,
          seasons: result.seasons,
          openedSeasonId: result.openedSeasonId,
          franchiseNodes: result.franchiseNodes,
          tmdbId: result.tmdbId,
          tmdbSeasonMap: result.tmdbSeasonMap,
        },
      };
      detailCache.set(cacheKeyDetail, { data: response, expires: Date.now() + 300000 });
      pruneApiCache(detailCache, API_CACHE_MAX);
      return response;
    }
    throw new Error("Anime not found");
  }

  // Check list cache for non-search queries
  if (!isSearch) {
    const cached = listCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;
  }

  let result: any;
  if (isSearch) {
    const keyword = params.get("keyword") || params.get("q") || "";
    const [anilistItems, jikanItems] = await Promise.all([
      searchAnime(keyword, page, genre).catch(() => []),
      searchViaJikan(keyword).catch(() => []),
    ]);

    const combined = [...anilistItems];
    const seenNames = new Set(anilistItems.map(item => item.name.toLowerCase()));
    const seenMalIds = new Set(anilistItems.map(item => item.idMal).filter(Boolean));

    for (const item of jikanItems) {
      const lowerName = item.name.toLowerCase();
      if (!seenNames.has(lowerName) && (!item.idMal || !seenMalIds.has(item.idMal))) {
        combined.push(item);
        seenNames.add(lowerName);
        if (item.idMal) seenMalIds.add(item.idMal);
      }
    }

    result = { success: true, data: filterUnreleased(combined).filter((item) => !isAdultContent(item.name, item.genres, item.description)) };
  } else if (isAiring) {
    const items = await getAiringAnime(page, genre);
    result = { success: true, data: items.filter((item) => !isAdultContent(item.name, item.genres, item.description)) };
  } else if (isTrending) {
    const items = await getTrendingAnime(page, genre);
    result = { success: true, data: items.filter((item) => !isAdultContent(item.name, item.genres, item.description)) };
  } else {
    // default: popular
    const items = await getPopularAnime(page, genre);
    result = { success: true, data: items.filter((item) => !isAdultContent(item.name, item.genres, item.description)) };
  }

  if (!isSearch) {
    listCache.set(cacheKey, { data: result, expires: Date.now() + 300000 }); // Cache for 5 minutes
    pruneApiCache(listCache, API_CACHE_MAX);
  }

  return result;
}

// Fetch real episode metadata (titles, thumbnails, descriptions) from Kitsu as a fallback
export async function fetchEpisodesFromKitsu(
  animeName: string,
  seasonCap: number
): Promise<EpisodeDetail[] | null> {
  try {
    const searchRes = await fetch(
      `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(animeName)}&page[limit]=1`,
      { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "CineStream/1.0" }, next: { revalidate: 86400 } }
    );
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const anime = searchJson.data?.[0];
    if (!anime) return null;

    const kitsuId = anime.id;
    const epRes = await fetch(
      `https://kitsu.io/api/edge/anime/${kitsuId}/episodes?page[limit]=${seasonCap}`,
      { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "CineStream/1.0" }, next: { revalidate: 86400 } }
    );
    if (!epRes.ok) return null;
    const epJson = await epRes.json();
    const epsData = epJson.data || [];

    const eps: EpisodeDetail[] = [];
    for (const ep of epsData) {
      const epNum = ep.attributes?.number;
      if (!epNum || epNum > seasonCap) continue;

      const title = ep.attributes?.canonicalTitle || ep.attributes?.title || `Episode ${epNum}`;
      const description = ep.attributes?.synopsis || null;
      const thumbnail = ep.attributes?.thumbnail?.original || null;

      eps.push({
        episodeId: `kitsu-${kitsuId}-${epNum}`,
        episodeNum: epNum,
        title,
        description,
        thumbnail,
        releasedDate: ep.attributes?.airdate || null,
        isFiller: false,
        isRecap: false,
      });
    }

    return eps.sort((a, b) => a.episodeNum - b.episodeNum);
  } catch (error) {
    console.error("[AnimeFetch] Kitsu fetch failed:", error);
    return null;
  }
}

