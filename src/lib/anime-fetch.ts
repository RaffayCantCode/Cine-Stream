// Multi-API Anime Fetcher
// Metadata: AniList (primary) -> TMDB -> AniZip -> Kitsu (fallback)
// Streaming: iframe embed sources only (no HLS)

import { isAdultContent } from "./content-filter";
import { tmdbFetch, searchTmdbShow, searchTmdbMovie, fetchTmdbEpisodeData, getCleanBaseTitle } from "./tmdb";
import { getCuratedAnimeFranchiseNodes, getFranchiseAnimeItem } from "./franchises";
import { recordPrimarySuccess, recordPrimaryFailure, shouldAttemptPrimary, isPrimaryAvailable } from "./anime-health";

export interface AnimeItem {
  id: string;
  idMal?: string | null;
  isAdult?: boolean;
  name: string;
  jname?: string | null;
  poster: string;
  bannerImage?: string | null;
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
  nextAiringEpisode?: { episode: number; airingAt: number; timeUntilAiring: number } | null;
  backdrop?: string | null;
  logoUrl?: string | null;
}

export interface SeasonInfo {
  id: string;
  name: string;
  seasonLabel: string;
  totalEpisodes: number;
  isCurrent: boolean;
  idMal?: number | null;
  seasonYear?: number | null;
  status?: string | null;
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
  isReleased?: boolean;
  isUpcoming?: boolean;
  malUrl?: string | null;
  seasonNum?: number;
  seasonId?: string;
  seasonName?: string;
  seasonMalId?: number | null;
  runtime?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
}

export interface FillerLookup {
  filler: Set<number>;
  mixed: Set<number>;
}

interface AniListMedia {
  id: number;
  idMal: number | null;
  isAdult?: boolean;
  title: { romaji: string; english: string | null; native: string | null };
  coverImage: { large: string; extraLarge: string };
  bannerImage?: string | null;
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
  nextAiringEpisode?: { episode: number; airingAt: number; timeUntilAiring: number } | null;
}

// A node in the franchise graph
export interface FranchiseNode {
  id: number;
  idMal: number | null;
  title: string;
  episodes: number | null;
  season: string | null;
  seasonYear: number | null;
  status?: string | null;
  format: string | null;
  duration: number | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  tmdbId?: number | null;
  tmdbSeasonNumber?: number | null;
  episodeOffset?: number;
}

import {
  KITSU_BASE,
  kitsuFetchJson,
  normalizeKitsuGenre,
  transformKitsu,
  searchViaKitsu,
  getPopularAnimeViaKitsu,
  getTrendingAnimeViaKitsu,
  getAiringAnimeViaKitsu,
  getUpcomingAnimeViaKitsu,
  fetchEpisodesFromKitsu,
  getAnimeDetailsViaKitsu,
} from "./kitsu";

export {
  KITSU_BASE,
  kitsuFetchJson,
  normalizeKitsuGenre,
  transformKitsu,
  searchViaKitsu,
  getPopularAnimeViaKitsu,
  getTrendingAnimeViaKitsu,
  getAiringAnimeViaKitsu,
  getUpcomingAnimeViaKitsu,
  fetchEpisodesFromKitsu,
  getAnimeDetailsViaKitsu,
};

const ANILIST_API = "https://graphql.anilist.co";
const ANIME_FILLER_LIST_BASE = "https://www.animefillerlist.com/shows";
export const DEFAULT_FETCH_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 CineStream/1.0";

interface ServerCacheEntry<T> {
  data: T;
  expires: number;
}
const serverAnilistCache = new Map<string, ServerCacheEntry<any>>();
const SERVER_CACHE_MAX = 500;

function getCachedAnilist<T>(key: string): T | null {
  const entry = serverAnilistCache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  if (entry) serverAnilistCache.delete(key);
  return null;
}

function setCachedAnilist<T>(key: string, data: T, ttlSeconds = 3600): void {
  if (serverAnilistCache.size >= SERVER_CACHE_MAX) {
    const firstKey = serverAnilistCache.keys().next().value;
    if (firstKey) serverAnilistCache.delete(firstKey);
  }
  serverAnilistCache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

export async function anilistQuery(query: string, variables: Record<string, any>, retries = 1, revalidate = 3600): Promise<any> {
  const cacheKey = `al_${query.length}_${JSON.stringify(variables)}`;
  const cached = getCachedAnilist<any>(cacheKey);
  if (cached) {
    recordPrimarySuccess();
    return cached;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ANILIST_API, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          "User-Agent": DEFAULT_FETCH_USER_AGENT,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(4500),
        next: { revalidate } as any,
      });

      if (res.status === 429) {
        if (attempt < retries) {
          const retryAfter = res.headers.get("retry-after");
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 800 * (attempt + 1);
          if (delay <= 1500) {
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
        }
        console.warn(`[AniList Rate Limit 429]: Attempt ${attempt + 1} rate limited`);
        return null;
      }
      
      if (!res.ok) {
        return null;
      }

      const json = await res.json();
      if (json?.data) {
        recordPrimarySuccess();
        setCachedAnilist(cacheKey, json, revalidate);
      }
      return json;
    } catch (e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

export function cleanAnimeDescription(html?: string | null): string {
  return (html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s*\(?\s*Source\s*[:：]\s*[^)]*\)?\s*$/i, "")
    .trim();
}

function transformAniList(media: AniListMedia): AnimeItem | null {
  if (media.isAdult) return null;
  let status = media.status || null;
  if (
    media.nextAiringEpisode &&
    (status === "NOT_YET_RELEASED" || status === "NOT_YET_AIRED")
  ) {
    status = "RELEASING";
  }
  if (media.status === "FINISHED") {
    status = "FINISHED";
  }
  return {
    id: String(media.id),
    idMal: media.idMal ? String(media.idMal) : null,
    isAdult: media.isAdult || false,
    name: media.title.english || media.title.romaji,
    jname: media.title.native || null,
    poster: media.coverImage?.extraLarge || media.coverImage?.large || "",
    bannerImage: media.bannerImage || null,
    backdrop: media.bannerImage || null,
    type: media.type || "TV",
    episodes: { sub: media.episodes || null, dub: null },
    rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : null,
    description: cleanAnimeDescription(media.description),
    genres: media.genres || [],
    status,
    season: media.season || null,
    seasonYear: media.seasonYear || null,
    format: media.format || null,
    duration: media.duration || null,
    trailerId: media.trailer?.site === "youtube" ? media.trailer.id : null,
    nextAiringEpisode: media.nextAiringEpisode || null,
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
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear trailer { id site }
    }
  }
}`;

const TRENDING_QUERY = `query ($page: Int, $genre: String) {
  Page(page: $page, perPage: 20) {
    media(
      type: ANIME,
      isAdult: false,
      sort: [TRENDING_DESC],
      genre: $genre
    ) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
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
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear duration
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
    if (s === "CANCELLED" || s === "Cancelled") return false;
    return true;
  });
}

function deduplicateAnime(items: AnimeItem[]): AnimeItem[] {
  const seen = new Set<string>();
  const seenMal = new Set<string>();
  const seenNames = new Set<string>();
  const grouped = new Map<string, AnimeItem>();

  for (const item of items) {
    if (!item || !item.name) continue;
    const lowerName = item.name.toLowerCase().trim();

    if (item.id && !seen.has(item.id)) {
      if (item.idMal && seenMal.has(item.idMal)) continue;
      if (seenNames.has(lowerName)) continue;

      seen.add(item.id);
      if (item.idMal) seenMal.add(item.idMal);
      seenNames.add(lowerName);
      grouped.set(item.id, item);
    }
  }
  return [...grouped.values()];
}

const SEARCH_QUERY = `query ($page: Int, $genre: String, $q: String) {
  Page(page: $page, perPage: 50) {
    media(
      type: ANIME,
      isAdult: false,
      genre: $genre,
      search: $q
    ) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear trailer { id site }
    }
  }
}`;

export async function searchAnime(q: string, page = 1, genre?: string): Promise<AnimeItem[]> {
  const cleanQ = q.trim();
  if (!cleanQ) return [];

  // Primary: AniList relevance search
  try {
    const data = await anilistQuery(SEARCH_QUERY, { page, q: cleanQ, genre: genre || null });
    if (data?.data?.Page?.media && data.data.Page.media.length > 0) {
      return filterUnreleased(deduplicateAnime((data.data.Page.media).map(transformAniList).filter(Boolean) as AnimeItem[]));
    }
  } catch (e) {
    console.warn("AniList search failed:", e);
  }

  // Fallback 1: Clean punctuation / special chars search on AniList
  if (cleanQ.includes("-") || cleanQ.includes("_") || cleanQ.includes(":") || cleanQ.includes("'")) {
    try {
      const altQ = cleanQ.replace(/[-_:'"]/g, " ").replace(/\s+/g, " ").trim();
      if (altQ && altQ !== cleanQ) {
        const data = await anilistQuery(SEARCH_QUERY, { page, q: altQ, genre: genre || null });
        if (data?.data?.Page?.media && data.data.Page.media.length > 0) {
          return filterUnreleased(deduplicateAnime((data.data.Page.media).map(transformAniList).filter(Boolean) as AnimeItem[]));
        }
      }
    } catch {}
  }

  // Fallback 2: Kitsu search (only if AniList returns nothing)
  try {
    const kResults = await searchViaKitsu(cleanQ, page, genre);
    if (kResults && kResults.length > 0) {
      return filterUnreleased(deduplicateAnime(kResults));
    }
  } catch (e) {
    console.warn("Kitsu search fallback failed:", e);
  }

  return [];
}

export async function getPopularAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(LIST_QUERY, { page, genre: genre || null, q: null });
    if (data?.data?.Page?.media && data.data.Page.media.length > 0) {
      return filterUnreleased(deduplicateAnime((data.data.Page.media).map(transformAniList).filter(Boolean) as AnimeItem[]));
    }
  } catch (e) {
    console.warn("AniList popular failed, falling back to Kitsu:", e);
  }

  // Fallback: Kitsu popular
  try {
    const kitsuItems = await getPopularAnimeViaKitsu(page, genre);
    if (kitsuItems && kitsuItems.length > 0) {
      return filterUnreleased(deduplicateAnime(kitsuItems));
    }
  } catch (e) {
    console.warn("Kitsu popular fallback failed:", e);
  }

  return [];
}

export async function getTrendingAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(TRENDING_QUERY, { page, genre: genre || null });
    if (data?.data?.Page?.media && data.data.Page.media.length > 0) {
      return filterUnreleased(deduplicateAnime((data.data.Page.media).map(transformAniList).filter(Boolean) as AnimeItem[]));
    }
  } catch (e) {
    console.warn("AniList trending failed, falling back to Kitsu:", e);
  }

  // Fallback: Kitsu trending
  try {
    const kitsuItems = await getTrendingAnimeViaKitsu(page, genre);
    if (kitsuItems && kitsuItems.length > 0) {
      return filterUnreleased(deduplicateAnime(kitsuItems));
    }
  } catch (e) {
    console.warn("Kitsu trending fallback failed:", e);
  }

  return [];
}

export async function getAiringAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const { season, year } = getCurrentSeason();
    const data = await anilistQuery(AIRING_QUERY, { page, genre: genre || null, season, year });
    if (data?.data?.Page?.media && data.data.Page.media.length > 0) {
      return filterUnreleased(deduplicateAnime((data.data.Page.media).map(transformAniList).filter(Boolean) as AnimeItem[]));
    }
  } catch (e) {
    console.warn("AniList airing failed, falling back to Kitsu:", e);
  }

  // Fallback: Kitsu airing
  try {
    const kitsuItems = await getAiringAnimeViaKitsu(page, genre);
    if (kitsuItems && kitsuItems.length > 0) {
      return filterUnreleased(deduplicateAnime(kitsuItems));
    }
  } catch (e) {
    console.warn("Kitsu airing fallback failed:", e);
  }

  return [];
}

const UPCOMING_QUERY = `query ($page: Int, $genre: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], status: NOT_YET_RELEASED, genre: $genre) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

export async function getUpcomingAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(UPCOMING_QUERY, { page, genre: genre || null });
    if (data?.data?.Page?.media && data.data.Page.media.length > 0) {
      return deduplicateAnime((data.data.Page.media).map(transformAniList).filter(Boolean) as AnimeItem[]);
    }
  } catch (e) {
    console.warn("AniList upcoming failed, falling back to Kitsu:", e);
  }

  // Fallback: Kitsu upcoming
  try {
    const kitsuItems = await getUpcomingAnimeViaKitsu(page, genre);
    if (kitsuItems && kitsuItems.length > 0) {
      return deduplicateAnime(kitsuItems);
    }
  } catch (e) {
    console.warn("Kitsu upcoming fallback failed:", e);
  }

  return [];
}

export async function getAnimeByGenre(genre: string, page = 1): Promise<AnimeItem[]> {
  return getPopularAnime(page, genre);
}

// ─────────────────────────────────────────────────────────────────────────────
// FRANCHISE GRAPH — FAST 2-LEVEL QUERY
// ─────────────────────────────────────────────────────────────────────────────

const FRANCHISE_RELATION_TYPES = new Set(["SEQUEL", "PREQUEL", "ALTERNATIVE", "PARENT", "SIDE_STORY", "SPIN_OFF"]);

const RELATIONS_SINGLE_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal title { romaji english native } episodes status season seasonYear format duration bannerImage coverImage { large extraLarge }
    relations {
      edges { relationType node { id idMal title { romaji english native } episodes status season seasonYear format duration type isAdult bannerImage coverImage { large extraLarge } } }
    }
  }
}`;

const BATCH_RELATIONS_QUERY = `query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id idMal title { romaji english native } episodes status season seasonYear format duration bannerImage coverImage { large extraLarge }
      relations {
        edges { relationType node { id idMal title { romaji english native } episodes status season seasonYear format duration type isAdult bannerImage coverImage { large extraLarge } } }
      }
    }
  }
}`;

export const FRANCHISE_GRAPH_CACHE = new Map<number, { nodes: FranchiseNode[]; timestamp: number }>();
export const FRANCHISE_GRAPH_TTL = 60 * 60 * 1000; // 1 hour in-memory cache

export function cacheFranchiseNodes(nodes: FranchiseNode[]): void {
  if (!nodes || nodes.length <= 1) return;
  const cacheEntry = { nodes, timestamp: Date.now() };
  for (const n of nodes) {
    if (n.id) {
      if (FRANCHISE_GRAPH_CACHE.size > 500) {
        const first = FRANCHISE_GRAPH_CACHE.keys().next().value;
        if (first !== undefined) FRANCHISE_GRAPH_CACHE.delete(first);
      }
      FRANCHISE_GRAPH_CACHE.set(Number(n.id), cacheEntry);
    }
    if (n.idMal) {
      FRANCHISE_GRAPH_CACHE.set(Number(n.idMal), cacheEntry);
    }
  }
}

export function getFastFranchiseNodes(startId: number, initialMedia?: any): FranchiseNode[] {
  const curated = getCuratedAnimeFranchiseNodes(startId);
  if (curated && curated.length > 1) {
    return curated as FranchiseNode[];
  }

  const cachedGraph = FRANCHISE_GRAPH_CACHE.get(startId);
  if (cachedGraph && Date.now() - cachedGraph.timestamp < FRANCHISE_GRAPH_TTL) {
    return cachedGraph.nodes;
  }

  const visited = new Map<number, FranchiseNode>();

  function addNode(data: any) {
    const id = Number(data.id);
    if (!id || isNaN(id)) return;
    if (!visited.has(id)) {
      visited.set(id, {
        id,
        idMal: data.idMal ? Number(data.idMal) : null,
        title: data.title?.english || data.title?.romaji || data.title?.native || data.name || "",
        episodes: (typeof data.episodes === "object" ? data.episodes?.sub : data.episodes) || null,
        season: data.season || null,
        seasonYear: data.seasonYear || null,
        status: data.status || null,
        format: data.format || null,
        duration: data.duration || null,
        coverImage: data.coverImage?.extraLarge || data.coverImage?.large || data.poster || null,
        bannerImage: data.bannerImage || null,
      });
    }
  }

  if (initialMedia) {
    addNode(initialMedia);
    const edges = initialMedia.relations?.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      const relType: string = edge.relationType || "";
      if (!FRANCHISE_RELATION_TYPES.has(relType)) continue;
      if (node?.type !== "ANIME" || node?.isAdult) continue;
      addNode(node);
    }
  }

  return [...visited.values()].filter(n => n.title);
}

export async function buildFranchiseGraph(startId: number, initialMedia?: any): Promise<FranchiseNode[]> {
  const curated = getCuratedAnimeFranchiseNodes(startId);
  if (curated && curated.length > 1) {
    return curated as FranchiseNode[];
  }

  const cachedGraph = FRANCHISE_GRAPH_CACHE.get(startId);
  if (cachedGraph && Date.now() - cachedGraph.timestamp < FRANCHISE_GRAPH_TTL) {
    return cachedGraph.nodes;
  }

  const visited = new Map<number, FranchiseNode>();

  function addNode(data: any) {
    const id = data.id as number;
    if (!visited.has(id)) {
      visited.set(id, {
        id,
        idMal: data.idMal || null,
        title: data.title?.english || data.title?.romaji || data.title?.native || "",
        episodes: data.episodes || null,
        season: data.season || null,
        seasonYear: data.seasonYear || null,
        status: data.status || null,
        format: data.format || null,
        duration: data.duration || null,
        coverImage: data.coverImage?.extraLarge || data.coverImage?.large || null,
        bannerImage: data.bannerImage || null,
      });
    }
  }

  function collectRelationIds(media: any): number[] {
    const ids: number[] = [];
    const edges = media?.relations?.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      const relType: string = edge.relationType || "";
      if (!FRANCHISE_RELATION_TYPES.has(relType)) continue;
      if (node?.type !== "ANIME" || node?.isAdult) continue;
      const nid = node.id as number;
      if (!visited.has(nid)) {
        ids.push(nid);
        visited.set(nid, {
          id: nid,
          idMal: node.idMal || null,
          title: node.title?.english || node.title?.romaji || node.title?.native || "",
          episodes: node.episodes || null,
          season: node.season || null,
          seasonYear: node.seasonYear || null,
          status: node.status || null,
          format: node.format || null,
          duration: node.duration || null,
          coverImage: node.coverImage?.extraLarge || node.coverImage?.large || null,
          bannerImage: node.bannerImage || null,
        });
      }
    }
    return ids;
  }

  try {
    let rootMedia = (initialMedia?.relations?.edges?.length > 0) ? initialMedia : null;
    if (!rootMedia) {
      const level1 = await anilistQuery(RELATIONS_SINGLE_QUERY, { id: startId }, 1, 3600);
      rootMedia = level1?.data?.Media;
    }
    if (!rootMedia) return [];

    addNode(rootMedia);
    let toFetch = collectRelationIds(rootMedia);
    let depth = 0;

    // Multi-level batch traversal (up to 5 levels deep, max 60 nodes)
    while (toFetch.length > 0 && depth < 5 && visited.size < 60) {
      depth++;
      const batchIds = toFetch.splice(0, 50);
      try {
        const batchRes = await anilistQuery(BATCH_RELATIONS_QUERY, { ids: batchIds }, 1, 3600);
        const medias = batchRes?.data?.Page?.media || [];
        for (const media of medias) {
          addNode(media);
          const newIds = collectRelationIds(media);
          toFetch.push(...newIds);
        }
      } catch (e) {
        console.warn(`[Franchise] Level ${depth + 1} batch fetch failed:`, e);
      }
    }
  } catch (e) {
    console.warn("[Franchise] Graph build failed:", e);
  }

  const nodes = [...visited.values()].filter(n => n.title);
  if (nodes.length > 1) {
    cacheFranchiseNodes(nodes);
  }
  return nodes;
}

export function buildSeasonList(
  clientNodes: FranchiseNode[],
  currentId: number
): SeasonInfo[] {
  const seasonOrder = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const sorted = [...clientNodes].sort((a, b) => {
    // Custom chronological order for Fate franchise
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

  let tvCount = 0;
  let movieCount = 0;
  let ovaCount = 0;
  let specialCount = 0;

  const mappedSeasons: SeasonInfo[] = sorted.map((node) => {
    const isShortMovie = node.format === "MOVIE"
      && (node.episodes || 1) <= 1
      && (node.duration || 0) > 0
      && node.duration! < 40;

    const isMovie = node.format === "MOVIE" && !isShortMovie;
    const isSpecial = node.format === "SPECIAL" || isShortMovie;
    const isActualOva = node.format === "OVA";

    let label: string = (node as any).seasonLabel || "";
    if (!label) {
      if (isMovie) { movieCount++; label = `Movie ${movieCount}`; }
      else if (isActualOva) { ovaCount++; label = `OVA ${ovaCount}`; }
      else if (isSpecial) { specialCount++; label = `Special ${specialCount}`; }
      else {
        const titleLower = node.title.toLowerCase();
        const partMatch = titleLower.match(/(?:part|cour)\s*(\d+)/i);
        if (partMatch && tvCount > 0) {
          label = `Season ${tvCount} Part ${partMatch[1]}`;
        } else {
          tvCount++;
          label = `Season ${tvCount}`;
        }
      }
    }

    const totalEp = isMovie
      ? 1
      : isActualOva || isSpecial
        ? Math.max(node.episodes || 1, 1)
        : (node.episodes ? Math.max(node.episodes, 1) : 0);

    let nodeStatus: string = (node as any).status || node.status || "";
    if (!nodeStatus) {
      if ((node as any).nextAiringEpisode) {
        nodeStatus = "RELEASING";
      } else if (node.seasonYear && node.seasonYear > new Date().getFullYear()) {
        nodeStatus = "NOT_YET_RELEASED";
      } else {
        nodeStatus = "FINISHED";
      }
    }

    return {
      id: String(node.id),
      name: node.title,
      seasonLabel: label,
      totalEpisodes: totalEp,
      isCurrent: node.id === currentId,
      idMal: node.idMal,
      seasonYear: node.seasonYear,
      status: nodeStatus,
      tmdbId: (node as any).tmdbId || null,
      tmdbSeasonNumber: (node as any).tmdbSeasonNumber || null,
      episodeOffset: (node as any).episodeOffset || 0,
      coverImage: node.coverImage || null,
      bannerImage: node.bannerImage || null,
    };
  });

  const filtered = mappedSeasons.filter(season => {
    if (season.isCurrent) return true;
    if (season.seasonLabel.startsWith("Season") || season.seasonLabel.startsWith("Movie")) return true;
    const lowerName = season.name.toLowerCase();
    const plotKeywords = ["final", "part", "chapter", "season", "arc", "prologue", "epilogue"];
    if (plotKeywords.some(kw => lowerName.includes(kw))) return true;
    return false;
  });

  if (filtered.length === 0 && mappedSeasons.length > 0) {
    return [mappedSeasons[0]];
  }

  return filtered;
}

export function parseSeasonNumberFromTitle(title: string): number {
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
  
  const finalSeasonNum = normalized.match(/(?:season\s*)?(\d+)(?:st|nd|rd|th)?\s+final\s+season/i)
    || normalized.match(/final\s+season\s+(\d+)/i);
  if (finalSeasonNum) return parseInt(finalSeasonNum[1], 10);
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

const INITIAL_EP_LIMIT = 100;

interface AnimeDetailsCacheEntry {
  data: {
    anime: AnimeItem;
    episodes: EpisodeDetail[];
    totalEpisodes: number;
    seasons: SeasonInfo[];
    openedSeasonId: string;
    franchiseNodes: FranchiseNode[];
    tmdbId?: number | null;
    tmdbSeasonMap?: Record<string, number>;
  };
  timestamp: number;
}
const ANIME_DETAILS_CACHE = new Map<string, AnimeDetailsCacheEntry>();
const ANIME_DETAILS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes in-memory cache

export function invalidateAnilistServerCache(): void {
  serverAnilistCache.clear();
}

export function invalidateAnimeDetailsCache(animeId?: string | number): void {
  if (!animeId) {
    ANIME_DETAILS_CACHE.clear();
    FRANCHISE_GRAPH_CACHE.clear();
    serverAnilistCache.clear();
  } else {
    const idStr = String(animeId).toLowerCase();
    for (const key of Array.from(ANIME_DETAILS_CACHE.keys())) {
      if (key.toLowerCase().includes(idStr)) {
        ANIME_DETAILS_CACHE.delete(key);
      }
    }
    const numId = Number(animeId);
    if (!isNaN(numId)) {
      FRANCHISE_GRAPH_CACHE.delete(numId);
    }
  }
}

/**
 * Clean Core Anime Detail Function
 * Pipeline: AniList (Primary) -> TMDB -> AniZip -> Kitsu (Fallback)
 * Artwork: Strictly corresponds to the anime opened (never overwritten by sequels)
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
  const cacheKey = `${id}-${epLimit}-${skipEpisodes}`;
  const cached = ANIME_DETAILS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ANIME_DETAILS_CACHE_TTL) {
    return JSON.parse(JSON.stringify(cached.data));
  }

  function cacheAndReturn(res: any) {
    if (res && res.anime) {
      if (ANIME_DETAILS_CACHE.size > 300) {
        const firstKey = ANIME_DETAILS_CACHE.keys().next().value;
        if (firstKey !== undefined) ANIME_DETAILS_CACHE.delete(firstKey);
      }
      ANIME_DETAILS_CACHE.set(cacheKey, { data: res, timestamp: Date.now() });
    }
    return res;
  }

  if (id.startsWith("kitsu-")) {
    const kitsuRes = await getAnimeDetailsViaKitsu(id, epLimit, skipEpisodes);
    return cacheAndReturn(kitsuRes);
  }

  const isMalInput = id.startsWith("mal-");
  let resolvedFromMal = false;
  if (isMalInput) {
    const malIdNum = parseInt(id.replace("mal-", ""), 10);
    if (!isNaN(malIdNum)) {
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
  }

  let resolvedFromTmdb = false;
  const curatedDirect = getFranchiseAnimeItem(id);
  if (curatedDirect && curatedDirect.anilist_id) {
    id = String(curatedDirect.anilist_id);
    resolvedFromTmdb = true;
  } else if (id.startsWith("tmdb-")) {
    const parts = id.split("-");
    if (parts.length >= 2) {
      const tmdbIdNum = parseInt(parts[1], 10);
      if (!isNaN(tmdbIdNum)) {
        const curatedByTmdb = getFranchiseAnimeItem(tmdbIdNum);
        if (curatedByTmdb && curatedByTmdb.anilist_id) {
          id = String(curatedByTmdb.anilist_id);
          resolvedFromTmdb = true;
        } else {
          try {
            const azRes = await fetch(`https://api.ani.zip/mappings?themoviedb_id=${tmdbIdNum}`, {
              signal: AbortSignal.timeout(2500),
              headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
              next: { revalidate: 86400 },
            });
            if (azRes.ok) {
              const azData = await azRes.json();
              if (azData?.mappings?.anilist_id) {
                id = String(azData.mappings.anilist_id);
                resolvedFromTmdb = true;
              }
            }
          } catch { /* ignore */ }
        }
      }
    }
  }

  let numId = parseInt(id, 10);
  if (isNaN(numId)) {
    try {
      const cleanTitle = id.replace(/[-_]/g, " ").trim();
      const q = `query ($search: String) {
        Media(search: $search, type: ANIME, isAdult: false) {
          id
        }
      }`;
      const searchRes = await anilistQuery(q, { search: cleanTitle });
      if (searchRes?.data?.Media?.id) {
        id = String(searchRes.data.Media.id);
        numId = searchRes.data.Media.id;
      }
    } catch {}
  }

  if (isNaN(numId)) {
    const kitsuRes = await getAnimeDetailsViaKitsu(id, epLimit, skipEpisodes);
    if (kitsuRes) return cacheAndReturn(kitsuRes);
    return null;
  }

  // Fetch AniZip mappings and AniList main media metadata in parallel
  const aniZipPromise = fetch(`https://api.ani.zip/mappings?anilist_id=${id}`, {
    signal: AbortSignal.timeout(3000),
    headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
    next: { revalidate: 86400 },
  }).then(async res => res.ok ? res.json() : null).catch(() => null);

  const mediaPromise = (async () => {
    try {
      const q = `query ($id: Int) {
        Media(id: $id, type: ANIME, isAdult: false) {
          id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
          episodes genres averageScore description status type format season seasonYear duration trailer { id site } nextAiringEpisode { episode airingAt timeUntilAiring }
          relations {
            edges {
              relationType
              node {
                id idMal title { romaji english native } episodes status season seasonYear format duration type isAdult bannerImage coverImage { large extraLarge }
              }
            }
          }
        }
      }`;
      const data = await anilistQuery(q, { id: numId }, 2, 86400);
      if (data?.data?.Media) {
        return data.data.Media;
      }
    } catch {}
    return null;
  })();

  const [aniZipMapping, fetchedMedia] = await Promise.all([aniZipPromise, mediaPromise]);
  let media = fetchedMedia;

  // Fallback 1: Lookup AniList by MAL ID if numId was MAL ID
  if (!media && !isNaN(numId)) {
    try {
      const qMal = `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME, isAdult: false) {
          id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
          episodes genres averageScore description status type format season seasonYear duration trailer { id site } nextAiringEpisode { episode airingAt timeUntilAiring }
          relations {
            edges {
              relationType
              node {
                id idMal title { romaji english native } episodes status season seasonYear format duration type isAdult bannerImage coverImage { large extraLarge }
              }
            }
          }
        }
      }`;
      const malRes = await anilistQuery(qMal, { idMal: numId }, 1, 86400);
      if (malRes?.data?.Media) {
        media = malRes.data.Media;
      }
    } catch {}
  }

  // Fallback 2: Curated franchise definition (e.g. offline fallback / 429 protection)
  if (!media && !isNaN(numId)) {
    const curatedNodes = getCuratedAnimeFranchiseNodes(numId);
    const curatedItem = curatedNodes?.find(n => String(n.id) === String(numId));
    if (curatedItem) {
      const epCount = curatedItem.episodes && curatedItem.episodes > 1 ? curatedItem.episodes : (curatedItem.format === "MOVIE" || curatedItem.format === "SPECIAL" ? 1 : 12);
      const animeItem: AnimeItem = {
        id: String(curatedItem.id),
        idMal: curatedItem.idMal ? String(curatedItem.idMal) : null,
        name: curatedItem.title,
        jname: null,
        poster: curatedItem.coverImage || "",
        bannerImage: curatedItem.bannerImage || null,
        backdrop: curatedItem.bannerImage || null,
        type: curatedItem.format || "TV",
        episodes: { sub: epCount, dub: null },
        rating: "8.8",
        description: "",
        genres: [],
        status: curatedItem.status || "FINISHED",
        season: null,
        seasonYear: curatedItem.seasonYear || null,
        format: curatedItem.format || "TV",
      };

      const seasonsList = buildSeasonList(curatedNodes || [], numId);
      const episodes: EpisodeDetail[] = [];
      for (let i = 1; i <= epCount; i++) {
        episodes.push({
          episodeId: `${numId}-${i}`,
          episodeNum: i,
          title: `Episode ${i}`,
          description: null,
          thumbnail: null,
          malUrl: null,
          releasedDate: null,
          isFiller: false,
          isRecap: false,
          seasonNum: 1,
          seasonId: String(numId),
          seasonName: curatedItem.title,
          seasonMalId: curatedItem.idMal || null,
        });
      }

      return cacheAndReturn({
        anime: animeItem,
        episodes: skipEpisodes ? [] : episodes,
        totalEpisodes: epCount,
        seasons: seasonsList,
        openedSeasonId: String(numId),
        franchiseNodes: curatedNodes || [],
        tmdbId: curatedItem.tmdbId || null,
        tmdbSeasonMap: curatedItem.tmdbSeasonNumber ? { [String(numId)]: curatedItem.tmdbSeasonNumber } : undefined,
      });
    }

    // Emergency Fallback: Kitsu details
    try {
      const kitsuFallback = await getAnimeDetailsViaKitsu(id, epLimit, skipEpisodes);
      if (kitsuFallback) return cacheAndReturn(kitsuFallback);
    } catch (e) {
      console.warn("Kitsu details fallback failed:", e);
    }

    return null;
  }

  if (!media) {
    const kitsuFallback = await getAnimeDetailsViaKitsu(id, epLimit, skipEpisodes);
    if (kitsuFallback) return cacheAndReturn(kitsuFallback);
    return null;
  }

  const anime = transformAniList(media);
  if (!anime) return null;

  // Resolve TMDB show/movie ID
  const isTargetMovie = anime.format === "MOVIE" || anime.type === "MOVIE" || media.format === "MOVIE";
  let searchedTmdbId: number | null = null;
  if (aniZipMapping?.mappings?.themoviedb_id) {
    searchedTmdbId = parseInt(aniZipMapping.mappings.themoviedb_id, 10);
    if (isNaN(searchedTmdbId)) searchedTmdbId = null;
  }

  // Curated franchise mapping check
  const curatedDirectItem = getFranchiseAnimeItem(numId);
  if (curatedDirectItem && curatedDirectItem.tmdb_id) {
    searchedTmdbId = curatedDirectItem.tmdb_id;
  }

  if (!searchedTmdbId) {
    try {
      if (isTargetMovie) {
        searchedTmdbId = await searchTmdbMovie(anime.name, anime.seasonYear || undefined);
        if (!searchedTmdbId && anime.jname) {
          searchedTmdbId = await searchTmdbMovie(anime.jname, anime.seasonYear || undefined);
        }
      } else {
        searchedTmdbId = await searchTmdbShow(anime.name, anime.seasonYear || undefined);
        if (!searchedTmdbId && anime.jname) {
          searchedTmdbId = await searchTmdbShow(anime.jname, anime.seasonYear || undefined);
        }
      }
    } catch {
      searchedTmdbId = null;
    }
  }

  let rawFranchiseNodes = getFastFranchiseNodes(numId, media);
  let franchiseNodes: FranchiseNode[] = rawFranchiseNodes || [];
  let tmdbId: number | null = searchedTmdbId;
  let tmdbSeasonMap: Record<string, number> = {};

  if (franchiseNodes && franchiseNodes.length > 0) {
    const seasonOrder = ["WINTER", "SPRING", "SUMMER", "FALL"];
    const EXCLUDED_IDS = new Set([6922, 19165, 12565]);
    franchiseNodes = franchiseNodes.filter(n => !EXCLUDED_IDS.has(Number(n.id)));

    franchiseNodes.sort((a, b) => {
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

    const targetNode = franchiseNodes.find(n => String(n.id) === String(numId));
    if (targetNode) {
      if (isTargetMovie || targetNode.format === "MOVIE") {
        targetNode.episodes = 1;
      } else {
        let realCount = media.episodes || null;
        if (aniZipMapping?.episodes) {
          const keys = Object.keys(aniZipMapping.episodes).map(Number).filter(k => !isNaN(k));
          if (keys.length > 0) realCount = Math.max(...keys, realCount || 0);
        }
        if (realCount) targetNode.episodes = Math.max(targetNode.episodes || 0, realCount);
      }
    }
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
      episodes: isTargetMovie ? 1 : (media.episodes || aniZipCount || null),
      season: media.season || null,
      seasonYear: media.seasonYear || null,
      format: media.format || null,
      duration: media.duration || null,
      coverImage: anime.poster,
      bannerImage: anime.bannerImage,
    }];
  }

  // Build seasons from franchise nodes
  const baseSeasons = buildSeasonList(franchiseNodes, numId);
  const mappedSeasons: SeasonInfo[] = [];

  // Group and map each AniList season to its TMDB season number and episodeOffset
  for (const s of baseSeasons) {
    const isSeasonMovie = s.seasonLabel.startsWith("Movie") || isTargetMovie;
    let tid = (s as any).tmdbId || (isSeasonMovie ? null : tmdbId);
    let tmdbSeasonNum: number | null = isSeasonMovie ? null : ((s as any).tmdbSeasonNumber ?? null);
    let episodeOffset = isSeasonMovie ? 0 : ((s as any).episodeOffset ?? 0);

    // Curated franchise override for high-priority anime
    const curatedSeason = getCuratedAnimeFranchiseNodes(Number(s.id) || numId)?.find(
      (n: any) => String(n.id) === String(s.id) || String(n.anilistId) === String(s.id)
    );
    if (curatedSeason) {
      if (!tid && curatedSeason.tmdbId) tid = curatedSeason.tmdbId;
      if (tmdbSeasonNum == null && curatedSeason.tmdbSeasonNumber != null) tmdbSeasonNum = curatedSeason.tmdbSeasonNumber;
      if (episodeOffset === 0 && curatedSeason.episodeOffset != null) episodeOffset = curatedSeason.episodeOffset;
    }

    // Derive TMDB mapping from active season AniZip data if current season
    if (String(s.id) === String(numId) && aniZipMapping?.episodes?.["1"]) {
      const ep1 = aniZipMapping.episodes["1"];
      if (ep1.seasonNumber !== undefined && (tmdbSeasonNum === null || tmdbSeasonNum === undefined)) {
        tmdbSeasonNum = ep1.seasonNumber;
      }
      if (ep1.episodeNumber !== undefined && (episodeOffset === 0)) {
        episodeOffset = Math.max(ep1.episodeNumber - 1, 0);
      }
    }

    if (!isSeasonMovie && (tmdbSeasonNum === null || tmdbSeasonNum === undefined)) {
      const parsedLabel = parseSeasonNumberFromTitle(s.seasonLabel || "");
      const parsedName = parseSeasonNumberFromTitle(s.name || "");
      tmdbSeasonNum = parsedLabel > 1 ? parsedLabel : parsedName > 1 ? parsedName : 1;
    }

    if (tid && tmdbSeasonNum !== null) {
      tmdbSeasonMap[s.id] = tmdbSeasonNum;
    }

    mappedSeasons.push({
      ...s,
      totalEpisodes: isSeasonMovie ? 1 : s.totalEpisodes,
      tmdbId: tid,
      tmdbSeasonNumber: tmdbSeasonNum,
      episodeOffset,
      coverImage: (s as any).coverImage || anime.poster,
      bannerImage: (s as any).bannerImage || anime.bannerImage,
    });
  }

  if (mappedSeasons.length === 0) {
    mappedSeasons.push({
      id: String(id),
      name: anime.name,
      seasonLabel: isTargetMovie ? "Movie 1" : "Season 1",
      totalEpisodes: isTargetMovie ? 1 : (anime.episodes?.sub || 12),
      isCurrent: true,
      idMal: anime.idMal ? Number(anime.idMal) : null,
      seasonYear: anime.seasonYear || null,
      status: anime.status || null,
      tmdbId,
      tmdbSeasonNumber: 1,
      episodeOffset: 0,
      coverImage: anime.poster,
      bannerImage: anime.bannerImage,
    });
  }

  // Artwork correctness:
  // 1. AniList official bannerImage is authoritative
  // 2. If no AniList bannerImage, attempt TMDB backdrop lookup
  if (!anime.bannerImage && tmdbId && !isTargetMovie) {
    try {
      const showData = await tmdbFetch(`/tv/${tmdbId}`) as any;
      if (showData?.backdrop_path) {
        anime.backdrop = `https://image.tmdb.org/t/p/original${showData.backdrop_path}`;
        anime.bannerImage = anime.backdrop;
      }
    } catch {}
  } else if (anime.bannerImage) {
    anime.backdrop = anime.bannerImage;
  }

  // Resolve official TMDB logo artwork for instant render on initial load
  const effectiveTmdbId = tmdbId || searchedTmdbId;
  if (effectiveTmdbId) {
    try {
      const imgRes = (await tmdbFetch(
        `/${isTargetMovie ? "movie" : "tv"}/${effectiveTmdbId}/images`,
        { include_image_language: "en,null,ja,es,fr,de,it,pt,ru,ko,zh" }
      )) as any;
      if (imgRes && Array.isArray(imgRes.logos) && imgRes.logos.length > 0) {
        const englishLogo = imgRes.logos.find((l: any) => l.iso_639_1 === "en" && l.file_path);
        const nullLangLogo = imgRes.logos.find((l: any) => (!l.iso_639_1 || l.iso_639_1 === "null") && l.file_path);
        const jaLogo = imgRes.logos.find((l: any) => l.iso_639_1 === "ja" && l.file_path);
        const chosen = englishLogo || nullLangLogo || jaLogo || imgRes.logos[0];
        if (chosen?.file_path) {
          anime.logoUrl = `https://image.tmdb.org/t/p/w500${chosen.file_path}`;
        }
      }
    } catch {}
  }

  const activeSeason = mappedSeasons.find(s => String(s.id) === String(numId)) || mappedSeasons[0];
  const activeSeasonId = activeSeason ? String(activeSeason.id) : String(id);

  if (skipEpisodes) {
    return cacheAndReturn({
      anime,
      episodes: [],
      totalEpisodes: activeSeason ? activeSeason.totalEpisodes : (anime.episodes?.sub || 12),
      seasons: mappedSeasons,
      openedSeasonId: activeSeasonId,
      franchiseNodes,
      tmdbId,
      tmdbSeasonMap: Object.keys(tmdbSeasonMap).length > 0 ? tmdbSeasonMap : undefined,
    });
  }

  // Fetch episodes for active season via AniZip
  const seasonCap = activeSeason ? activeSeason.totalEpisodes : (anime.episodes?.sub || 12);
  let seasonEps: EpisodeDetail[] = [];
  try {
    const azEps = await fetchEpisodesFromAniZip(activeSeasonId, seasonCap);
    if (azEps && azEps.length > 0) {
      seasonEps = isTargetMovie ? [azEps[0]] : azEps;
    }
  } catch {}

  // Fallback to Kitsu episodes if AniZip had no episodes
  if (seasonEps.length === 0) {
    try {
      const kitsuEps = await fetchEpisodesFromKitsu(anime.name, seasonCap);
      if (kitsuEps && kitsuEps.length > 0) {
        seasonEps = kitsuEps.map(ke => ({
          episodeId: `${activeSeasonId}-${ke.episodeNum}`,
          episodeNum: ke.episodeNum,
          title: ke.title || `Episode ${ke.episodeNum}`,
          description: ke.description || null,
          thumbnail: ke.thumbnail || null,
          releasedDate: ke.releasedDate || null,
          isFiller: false,
          isRecap: false,
          seasonNum: 1,
          seasonId: activeSeasonId,
          seasonName: activeSeason?.name || anime.name,
        }));
      }
    } catch {}
  }

  // Ensure placeholders if still empty
  if (seasonEps.length === 0) {
    const epCount = isTargetMovie ? 1 : Math.max(seasonCap || 12, 1);
    for (let i = 1; i <= epCount; i++) {
      seasonEps.push({
        episodeId: `${activeSeasonId}-${i}`,
        episodeNum: i,
        title: isTargetMovie ? (activeSeason?.name || anime.name || "Complete Movie") : `Episode ${i}`,
        description: isTargetMovie ? anime.description || null : null,
        thumbnail: isTargetMovie ? anime.poster || null : null,
        malUrl: null,
        releasedDate: null,
        isFiller: false,
        isRecap: false,
        seasonNum: 1,
        seasonId: activeSeasonId,
        seasonName: activeSeason?.name || anime.name,
      });
    }
  }

  return cacheAndReturn({
    anime,
    episodes: seasonEps,
    totalEpisodes: activeSeason ? activeSeason.totalEpisodes : seasonEps.length,
    seasons: mappedSeasons,
    openedSeasonId: activeSeasonId,
    franchiseNodes,
    tmdbId,
    tmdbSeasonMap: Object.keys(tmdbSeasonMap).length > 0 ? tmdbSeasonMap : undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EPISODE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchEpisodesFromAniZip(
  anilistId: string,
  seasonCap: number
): Promise<EpisodeDetail[] | null> {
  try {
    const cleanId = String(anilistId || "").trim();
    const queryParam = cleanId.startsWith("kitsu-")
      ? `kitsu_id=${cleanId.replace("kitsu-", "")}`
      : cleanId.startsWith("mal-")
        ? `mal_id=${cleanId.replace("mal-", "")}`
        : isNaN(Number(cleanId))
          ? `kitsu_id=${cleanId}`
          : `anilist_id=${cleanId}`;

    const res = await fetch(`https://api.ani.zip/mappings?${queryParam}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
      next: { revalidate: 86400 } as any,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.episodes) return null;

    const eps: EpisodeDetail[] = [];
    const isMovieType = (json.mappings?.type || "").toUpperCase() === "MOVIE";
    const ep1Title = (json.episodes?.['1']?.title?.en || json.episodes?.['1']?.title?.['x-jat'] || "").toLowerCase();
    const isExplicitMovie = isMovieType || (seasonCap === 1 && ep1Title.includes("complete movie"));
    const hasPartSplits = isExplicitMovie && Object.values(json.episodes || {}).some((e: any) => {
      const t = (e?.title?.en || e?.title?.['x-jat'] || "").toLowerCase();
      return t.startsWith("part 1 of") || t.startsWith("part 2 of");
    });
    const isSingleEpCap = isExplicitMovie || hasPartSplits;
    const effectiveCap = isSingleEpCap ? 1 : (seasonCap && seasonCap > 1 ? seasonCap : 1500);

    for (const key of Object.keys(json.episodes)) {
      const epNum = parseInt(key, 10);
      if (isNaN(epNum) || epNum > effectiveCap) continue;

      const ep = json.episodes[key];
      if (isSingleEpCap && epNum > 1) continue;
      const title = ep.title?.en || ep.title?.['x-jat'] || ep.title?.ja || `Episode ${epNum}`;
      const description = ep.overview || ep.summary || null;
      let thumbnail = ep.image || null;
      if (thumbnail && (thumbnail.includes("/cover/") || thumbnail.includes("/banner/") || /\/bx\d+[-]/.test(thumbnail))) {
        thumbnail = null;
      }
      const releasedDate = ep.airDate || ep.airdate || null;
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

export async function resolveTmdbMappingFromAniZip(
  anilistId: string
): Promise<{ tmdbId: number; tmdbSeason: number; episodeOffset: number } | null> {
  try {
    const cleanId = String(anilistId || "").trim();
    const queryParam = cleanId.startsWith("kitsu-")
      ? `kitsu_id=${cleanId.replace("kitsu-", "")}`
      : cleanId.startsWith("mal-")
        ? `mal_id=${cleanId.replace("mal-", "")}`
        : isNaN(Number(cleanId))
          ? `kitsu_id=${cleanId}`
          : `anilist_id=${cleanId}`;

    const res = await fetch(`https://api.ani.zip/mappings?${queryParam}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
      next: { revalidate: 86400 } as any,
    });
    if (!res.ok) return null;
    const az = await res.json();

    let tmdbId: number | null = null;
    if (az?.mappings?.themoviedb_id) {
      tmdbId = parseInt(az.mappings.themoviedb_id, 10);
      if (isNaN(tmdbId)) tmdbId = null;
    }
    if (!tmdbId) return null;
    const effectiveTmdbId: number = tmdbId;

    const curatedMappingItem = getCuratedAnimeFranchiseNodes(parseInt(anilistId, 10))
      ?.find(n => String(n.id) === String(anilistId));
    if (curatedMappingItem) {
      if (curatedMappingItem.tmdbId) tmdbId = curatedMappingItem.tmdbId;
      if (curatedMappingItem.tmdbSeasonNumber != null && curatedMappingItem.episodeOffset != null) {
        return {
          tmdbId: curatedMappingItem.tmdbId || effectiveTmdbId,
          tmdbSeason: curatedMappingItem.tmdbSeasonNumber,
          episodeOffset: curatedMappingItem.episodeOffset,
        };
      }
    }

    const azEp1 = az?.episodes?.["1"];
    let tmdbSeason = 1;
    let episodeOffset = 0;
    if (azEp1 && azEp1.seasonNumber !== undefined && azEp1.episodeNumber !== undefined) {
      tmdbSeason = azEp1.seasonNumber;
      episodeOffset = Math.max(azEp1.episodeNumber - 1, 0);
    }

    return { tmdbId: effectiveTmdbId, tmdbSeason, episodeOffset };
  } catch {
    return null;
  }
}

function normalizeFillerSlugPart(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(tv|ona|ova|special|movie)\b/g, " ")
    .replace(/\b(part|cour)\s+\d+\b/g, " ")
    .replace(/\bseason\s+\d+\b/g, " ")
    .replace(/\b\d+(st|nd|rd|th)\s+season\b/g, " ")
    .replace(/\bfinal\s+season\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildAnimeFillerListSlugCandidates(animeName: string): string[] {
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

function parseAnimeFillerListRows(html: string): FillerLookup {
  const filler = new Set<number>();
  const mixed = new Set<number>();
  const rowRegex = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html))) {
    const attrs = rowMatch[1] || "";
    const body = rowMatch[2] || "";
    const classMatch = attrs.match(/class=["']([^"']+)["']/i);
    const rowClass = (classMatch?.[1] || "").toLowerCase();
    if (!rowClass.includes("filler")) continue;

    const numberMatch = body.match(/<td\b[^>]*class=["'][^"']*\bNumber\b[^"']*["'][^>]*>\s*(\d+)\s*<\/td>/i)
      || body.match(/<td\b[^>]*>\s*(\d+)\s*<\/td>/i);
    const episodeNum = numberMatch ? parseInt(numberMatch[1], 10) : NaN;
    if (!episodeNum || Number.isNaN(episodeNum)) continue;

    if (rowClass.includes("mixed_canon/filler")) mixed.add(episodeNum);
    else filler.add(episodeNum);
  }

  return { filler, mixed };
}

export async function fetchFillerLookupFromAnimeFillerList(
  animeName: string
): Promise<FillerLookup | null> {
  for (const slug of buildAnimeFillerListSlugCandidates(animeName)) {
    try {
      const res = await fetch(`${ANIME_FILLER_LIST_BASE}/${slug}`, {
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "CineStream/1.0" },
        next: { revalidate: 86400 } as any,
      });
      if (!res.ok) continue;

      const lookup = parseAnimeFillerListRows(await res.text());
      if (lookup.filler.size > 0 || lookup.mixed.size > 0) {
        return lookup;
      }
    } catch {}
  }
  return null;
}

export async function fetchEpisodeThumbnail(malUrl: string): Promise<string | null> {
  try {
    const res = await fetch(malUrl, {
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
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

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER HELPER (used by main API routes)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAnimeApi(
  endpoint: string,
  isDetail = false
): Promise<any> {
  const [path, queryString] = endpoint.split("?");
  const params = new URLSearchParams(queryString || "");
  const page = parseInt(params.get("page") || "1", 10);
  const genre = params.get("genre") || undefined;

  const isSearch = path.includes("/search") || path.includes("keyword=");
  const isSeries = path.startsWith("/series/");

  if (isDetail || isSeries) {
    const id = path.replace("/series/", "").split("?")[0];
    const result = await getAnimeDetails(id);
    if (result) {
      return {
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
    }
    throw new Error("Anime not found");
  }

  if (isSearch) {
    const keyword = params.get("keyword") || params.get("q") || "";
    const items = await searchAnime(keyword, page, genre);
    return {
      success: true,
      data: items,
    };
  }

  const items = await getPopularAnime(page, genre);
  return {
    success: true,
    data: items,
  };
}
