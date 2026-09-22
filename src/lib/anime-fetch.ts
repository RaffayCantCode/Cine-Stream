// Clean Core Anime Architecture — Ground-Up Rewrite
// Pipeline: AniList (Primary) -> TMDB -> AniZip -> Kitsu (Fallback)

import { tmdbFetch, searchTmdbShow, searchTmdbMovie } from "./tmdb";
import { getCuratedAnimeFranchiseNodes, getFranchiseAnimeItem } from "./franchises";
import { recordPrimarySuccess, recordPrimaryFailure, shouldAttemptPrimary, isPrimaryAvailable } from "./anime-health";

// ─────────────────────────────────────────────────────────────────────────────
// 1. TYPES
// ─────────────────────────────────────────────────────────────────────────────

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

export interface FranchiseNode {
  id: number | string;
  idMal?: number | null;
  title: string;
  episodes?: number | null;
  totalEpisodes?: number | null;
  season?: string | null;
  seasonYear: number | null;
  status?: string | null;
  format: string | null;
  duration?: number | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  tmdbId?: number | null;
  tmdbSeasonNumber?: number | null;
  episodeOffset?: number;
}

export interface FillerLookup {
  filler: Set<number>;
  mixed: Set<number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. KITSU RE-EXPORTS (for caller compatibility)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONSTANTS & SERVER-SIDE CACHES
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_FETCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 CineStream/1.0";

const ANILIST_API = "https://graphql.anilist.co";
const FILLER_BASE = "https://www.animefillerlist.com/shows";

interface CacheEntry<T> { data: T; expires: number; }

const anilistCache = new Map<string, CacheEntry<any>>();

function getAnilistCached<T>(key: string): T | null {
  const e = anilistCache.get(key);
  if (e && e.expires > Date.now()) return e.data as T;
  if (e) anilistCache.delete(key);
  return null;
}

function setAnilistCached<T>(key: string, data: T, ttl = 3600): void {
  if (anilistCache.size >= 500) {
    const first = anilistCache.keys().next().value;
    if (first) anilistCache.delete(first);
  }
  anilistCache.set(key, { data, expires: Date.now() + ttl * 1000 });
}

export function invalidateAnilistServerCache(): void {
  anilistCache.clear();
}

export const FRANCHISE_GRAPH_CACHE = new Map<number | string, { nodes: FranchiseNode[]; timestamp: number }>();
export const FRANCHISE_GRAPH_TTL = 60 * 60 * 1000;

export function cacheFranchiseNodes(nodes: FranchiseNode[]): void {
  if (!nodes || nodes.length <= 1) return;
  const entry = { nodes, timestamp: Date.now() };
  for (const n of nodes) {
    const sId = String(n.id || "").trim();
    if (sId && sId !== "NaN" && sId !== "null" && sId !== "undefined") {
      if (FRANCHISE_GRAPH_CACHE.size > 500) {
        const first = FRANCHISE_GRAPH_CACHE.keys().next().value;
        if (first !== undefined) FRANCHISE_GRAPH_CACHE.delete(first);
      }
      FRANCHISE_GRAPH_CACHE.set(sId, entry);
      const numId = parseInt(sId.replace(/\D/g, ""), 10);
      if (!isNaN(numId) && numId > 0) {
        FRANCHISE_GRAPH_CACHE.set(numId, entry);
      }
    }
    if (n.idMal) {
      const numMal = Number(n.idMal);
      if (!isNaN(numMal) && numMal > 0) {
        FRANCHISE_GRAPH_CACHE.set(numMal, entry);
      }
    }
  }
}

interface DetailsCacheEntry {
  data: AnimeDetailsResult;
  timestamp: number;
}

interface AnimeDetailsResult {
  anime: AnimeItem;
  episodes: EpisodeDetail[];
  totalEpisodes: number;
  seasons: SeasonInfo[];
  openedSeasonId: string;
  franchiseNodes: FranchiseNode[];
  tmdbId?: number | null;
  tmdbSeasonMap?: Record<string, number>;
}

const detailsCache = new Map<string, DetailsCacheEntry>();
const DETAILS_TTL = 30 * 60 * 1000;

export function invalidateAnimeDetailsCache(animeId?: string | number): void {
  if (!animeId) {
    detailsCache.clear();
    FRANCHISE_GRAPH_CACHE.clear();
    anilistCache.clear();
    return;
  }
  const sId = String(animeId).toLowerCase();
  for (const key of Array.from(detailsCache.keys())) {
    if (key.toLowerCase().includes(sId)) detailsCache.delete(key);
  }
  const num = Number(animeId);
  if (!isNaN(num)) FRANCHISE_GRAPH_CACHE.delete(num);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ANILIST QUERY CLIENT
// ─────────────────────────────────────────────────────────────────────────────

export async function anilistQuery(
  query: string,
  variables: Record<string, any>,
  retries = 1,
  revalidate = 3600
): Promise<any> {
  const key = `al_${query.length}_${JSON.stringify(variables)}`;
  const cached = getAnilistCached<any>(key);
  if (cached) { recordPrimarySuccess(); return cached; }

  // Fast Circuit Breaker: If AniList has had consecutive failures, skip immediately
  if (!shouldAttemptPrimary()) {
    return null;
  }

  const maxRetries = isPrimaryAvailable() ? retries : 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": DEFAULT_FETCH_USER_AGENT },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(2500),
        next: { revalidate } as any,
      });

      if (res.status === 429 || res.status === 403 || res.status >= 500) {
        recordPrimaryFailure();
        return null;
      }

      if (!res.ok) {
        recordPrimaryFailure();
        return null;
      }
      const json = await res.json();
      if (json?.data) { recordPrimarySuccess(); setAnilistCached(key, json, revalidate); }
      return json;
    } catch {
      if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 250 * (attempt + 1))); continue; }
      recordPrimaryFailure();
      return null;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TRANSFORM & UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export function cleanAnimeDescription(html?: string | null): string {
  return (html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s*\(?\s*Source\s*[::\u0026]\s*[^)]*\)?\s*$/i, "")
    .trim();
}

function transformAniList(media: any): AnimeItem | null {
  if (media?.isAdult) return null;
  let status = media.status || null;
  if (media.nextAiringEpisode && (status === "NOT_YET_RELEASED" || status === "NOT_YET_AIRED")) status = "RELEASING";
  return {
    id: String(media.id),
    idMal: media.idMal ? String(media.idMal) : null,
    isAdult: media.isAdult || false,
    name: media.title?.english || media.title?.romaji || "",
    jname: media.title?.native || null,
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

function deduplicate(items: AnimeItem[]): AnimeItem[] {
  const seenId = new Set<string>();
  const seenMal = new Set<string>();
  const seenName = new Set<string>();
  const out: AnimeItem[] = [];
  for (const item of items) {
    if (!item?.name || !item?.id) continue;
    const lname = item.name.toLowerCase().trim();
    if (seenId.has(item.id) || (item.idMal && seenMal.has(item.idMal)) || seenName.has(lname)) continue;
    seenId.add(item.id);
    if (item.idMal) seenMal.add(item.idMal);
    seenName.add(lname);
    out.push(item);
  }
  return out;
}

function toNode(data: any): FranchiseNode | null {
  const id = Number(data?.id);
  if (!id || isNaN(id)) return null;
  return {
    id,
    idMal: data.idMal ? Number(data.idMal) : null,
    title: data.title?.english || data.title?.romaji || data.title?.native || data.name || "",
    episodes: (typeof data.episodes === "object" ? data.episodes?.sub : data.episodes) || null,
    totalEpisodes: (typeof data.episodes === "object" ? data.episodes?.sub : data.episodes) || null,
    season: data.season || null,
    seasonYear: data.seasonYear || null,
    status: data.status || null,
    format: data.format || null,
    duration: data.duration || null,
    coverImage: data.coverImage?.extraLarge || data.coverImage?.large || data.poster || null,
    bannerImage: data.bannerImage || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. FRANCHISE & SEASON BUILDING — SINGLE CANONICAL IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

const FRANCHISE_RELS = new Set(["SEQUEL", "PREQUEL", "ALTERNATIVE", "PARENT", "SIDE_STORY", "SPIN_OFF"]);
const FATE_ORDER = [10087, 11741, 356, 19603, 20792, 20791, 21718, 21719];
const SEASON_ORDER = ["WINTER", "SPRING", "SUMMER", "FALL"];
const FORMAT_ORDER: Record<string, number> = { TV: 0, TV_SHORT: 1, ONA: 2, OVA: 3, SPECIAL: 4, MOVIE: 5 };

export function sortFranchiseNodes(nodes: FranchiseNode[]): FranchiseNode[] {
  return [...nodes].sort((a, b) => {
    const iA = FATE_ORDER.indexOf(Number(a.id));
    const iB = FATE_ORDER.indexOf(Number(b.id));
    if (iA !== -1 && iB !== -1) return iA - iB;
    if (iA !== -1) return -1;
    if (iB !== -1) return 1;

    // TMDB season numbers take priority if same show
    if (a.tmdbId && b.tmdbId && String(a.tmdbId) === String(b.tmdbId)) {
      if (a.tmdbSeasonNumber && b.tmdbSeasonNumber && a.tmdbSeasonNumber !== b.tmdbSeasonNumber) {
        return a.tmdbSeasonNumber - b.tmdbSeasonNumber;
      }
      if (a.tmdbSeasonNumber === b.tmdbSeasonNumber) {
        const offDiff = (a.episodeOffset || 0) - (b.episodeOffset || 0);
        if (offDiff !== 0) return offDiff;
      }
    }

    const yA = a.seasonYear || 9999;
    const yB = b.seasonYear || 9999;
    if (yA !== yB) return yA - yB;
    const fA = FORMAT_ORDER[a.format || "TV"] ?? 6;
    const fB = FORMAT_ORDER[b.format || "TV"] ?? 6;
    if (fA !== fB) return fA - fB;
    return SEASON_ORDER.indexOf(a.season || "FALL") - SEASON_ORDER.indexOf(b.season || "FALL");
  });
}

export function parseSeasonNumberFromTitle(title: string): number | null {
  const lower = (title || "").toLowerCase();
  const m = lower.match(/season\s*([0-9]+)/);
  if (m) return parseInt(m[1], 10);
  const ordMatch = lower.match(/([0-9]+)(?:st|nd|rd|th)\s+season/);
  if (ordMatch) return parseInt(ordMatch[1], 10);
  const ordinals: Record<string, number> = {
    "first": 1, "1st": 1,
    "second": 2, "2nd": 2,
    "third": 3, "3rd": 3,
    "fourth": 4, "4th": 4,
    "fifth": 5, "5th": 5,
    "sixth": 6, "6th": 6,
    "seventh": 7, "7th": 7,
    "eighth": 8, "8th": 8,
    "final season": 4,
  };
  for (const [k, v] of Object.entries(ordinals)) {
    if (new RegExp(`\\b${k}\\b`, "i").test(lower)) return v;
  }
  const endNum = lower.match(/(?:\s+|:)([2-9])$/);
  if (endNum) return parseInt(endNum[1], 10);
  return null;
}

export function buildSeasonList(nodes: FranchiseNode[], currentId: number): SeasonInfo[] {
  const sorted = sortFranchiseNodes(nodes);
  let tvCount = 0, movieCount = 0, ovaCount = 0, specialCount = 0;

  const seasons: SeasonInfo[] = sorted.map(node => {
    const shortMovie = node.format === "MOVIE" && (node.episodes || 1) <= 1 && (node.duration || 0) > 0 && node.duration! < 40;
    const isMovie = node.format === "MOVIE" && !shortMovie;
    const isSpecial = node.format === "SPECIAL" || shortMovie;
    const isOva = node.format === "OVA";

    let label = (node as any).seasonLabel || "";
    if (!label) {
      if (isMovie) { movieCount++; label = `Movie ${movieCount}`; }
      else if (isOva) { ovaCount++; label = `OVA ${ovaCount}`; }
      else if (isSpecial) { specialCount++; label = `Special ${specialCount}`; }
      else {
        const sNum = node.tmdbSeasonNumber || null;
        const explicitSeason = node.title.match(/season\s*(\d+)/i) || node.title.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
        const explicitPart = node.title.match(/(?:part|cour)\s*(\d+)/i);
        const partNum = explicitPart ? parseInt(explicitPart[1], 10) : null;
        const isFinal = /\b(final\s+season|the\s+final)\b/i.test(node.title);

        if (sNum) {
          tvCount = Math.max(tvCount, sNum);
          if (node.episodeOffset && node.episodeOffset > 0) {
            label = `Season ${sNum} Part 2`;
          } else if (explicitPart && (partNum === 2 || partNum === 3) && explicitSeason) {
            label = `Season ${sNum} Part ${partNum}`;
          } else {
            label = `Season ${sNum}`;
          }
        } else if (explicitSeason) {
          const parsed = parseInt(explicitSeason[1], 10);
          tvCount = Math.max(tvCount, parsed);
          if (partNum && (partNum === 2 || partNum === 3)) {
            label = `Season ${parsed} Part ${partNum}`;
          } else {
            label = `Season ${parsed}`;
          }
        } else if (isFinal) {
          const finalNum = Math.max(tvCount + 1, 4);
          if (partNum && (partNum === 2 || partNum === 3) && tvCount >= 4) {
            label = `Season ${tvCount} Part ${partNum}`;
          } else {
            tvCount = finalNum;
            label = `Season ${finalNum}`;
          }
        } else if (partNum && (partNum === 2 || partNum === 3) && tvCount > 0 && !node.title.toLowerCase().includes("jojo")) {
          label = `Season ${tvCount} Part ${partNum}`;
        } else {
          tvCount++;
          label = `Season ${tvCount}`;
        }
      }
    }

    let status = node.status || "";
    if (!status) status = (node.seasonYear || 0) > new Date().getFullYear() ? "NOT_YET_RELEASED" : "FINISHED";

    return {
      id: String(node.id),
      name: node.title,
      seasonLabel: label,
      totalEpisodes: isMovie ? 1 : Math.max((node as any).totalEpisodes || node.episodes || (node.status === "RELEASING" ? 1500 : 1), 1),
      isCurrent: Number(node.id) === Number(currentId),
      idMal: node.idMal,
      seasonYear: node.seasonYear,
      status,
      tmdbId: node.tmdbId || null,
      tmdbSeasonNumber: node.tmdbSeasonNumber || null,
      episodeOffset: node.episodeOffset || 0,
      coverImage: node.coverImage || null,
      bannerImage: node.bannerImage || null,
    };
  });

  const filtered = seasons.filter(s =>
    s.isCurrent ||
    Boolean(s.seasonLabel) ||
    ["final", "part", "chapter", "season", "arc", "prologue", "epilogue"].some(kw => s.name.toLowerCase().includes(kw))
  );

  return filtered.length > 0 ? filtered : seasons.slice(0, 1);
}

export function getFastFranchiseNodes(startId: number, initialMedia?: any): FranchiseNode[] {
  const curated = getCuratedAnimeFranchiseNodes(startId);
  if (curated && curated.length > 1) return curated as FranchiseNode[];

  const cached = FRANCHISE_GRAPH_CACHE.get(startId);
  if (cached && Date.now() - cached.timestamp < FRANCHISE_GRAPH_TTL) return cached.nodes;

  const visited = new Map<number | string, FranchiseNode>();
  if (initialMedia) {
    const root = toNode(initialMedia);
    if (root) visited.set(root.id, root);
    for (const edge of initialMedia.relations?.edges || []) {
      if (!FRANCHISE_RELS.has(edge.relationType || "")) continue;
      if (edge.node?.type !== "ANIME" || edge.node?.isAdult) continue;
      const n = toNode(edge.node);
      if (n && !visited.has(n.id)) visited.set(n.id, n);
    }
  }
  return sortFranchiseNodes([...visited.values()]);
}

export async function buildFranchiseGraph(startId: number, initialMedia?: any): Promise<FranchiseNode[]> {
  const curated = getCuratedAnimeFranchiseNodes(startId);
  if (curated && curated.length > 1) return curated as FranchiseNode[];

  const cached = FRANCHISE_GRAPH_CACHE.get(startId);
  if (cached && Date.now() - cached.timestamp < FRANCHISE_GRAPH_TTL && cached.nodes.length > 1) return cached.nodes;

  const visited = new Map<number | string, FranchiseNode>();
  const queued = new Set<number>([startId]);
  let queue: number[] = [startId];

  let rootMedia = initialMedia?.relations?.edges?.length ? initialMedia : null;
  if (rootMedia) {
    const root = toNode(rootMedia);
    if (root) visited.set(root.id, root);
    for (const edge of rootMedia.relations?.edges || []) {
      if (!FRANCHISE_RELS.has(edge.relationType || "")) continue;
      if (edge.node?.type !== "ANIME" || edge.node?.isAdult) continue;
      const nextId = edge.node.id;
      if (!queued.has(nextId)) {
        queued.add(nextId);
        queue.push(nextId);
      }
      const n = toNode(edge.node);
      if (n && !visited.has(n.id)) visited.set(n.id, n);
    }
  }

  // Multi-hop BFS: explore queue in batches of 50 up to depth 4 or 40 nodes max
  for (let hop = 0; hop < 4 && queue.length > 0 && visited.size < 40; hop++) {
    const batch = queue.splice(0, 50);
    try {
      const batchRes = await anilistQuery(`query ($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME) {
            id idMal title { romaji english native } episodes status season seasonYear format duration bannerImage coverImage { large extraLarge }
            relations { edges { relationType node { id idMal title { romaji english native } episodes status season seasonYear format duration type isAdult bannerImage coverImage { large extraLarge } } } }
          }
        }
      }`, { ids: batch }, 1, 3600);

      const mediaList = batchRes?.data?.Page?.media || [];
      for (const m of mediaList) {
        const n = toNode(m);
        if (n) visited.set(n.id, n);

        for (const edge of m.relations?.edges || []) {
          if (!FRANCHISE_RELS.has(edge.relationType || "")) continue;
          if (edge.node?.type !== "ANIME" || edge.node?.isAdult) continue;
          const nextId = edge.node.id;
          if (!queued.has(nextId)) {
            queued.add(nextId);
            queue.push(nextId);
          }
          const relNode = toNode(edge.node);
          if (relNode && !visited.has(relNode.id)) {
            visited.set(relNode.id, relNode);
          }
        }
      }
    } catch {
      break;
    }
  }

  const nodes = sortFranchiseNodes([...visited.values()]);
  if (nodes.length > 1) cacheFranchiseNodes(nodes);
  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. BROWSE & SEARCH
// ─────────────────────────────────────────────────────────────────────────────

const LIST_Q = `query ($page: Int, $genre: String, $q: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], genre: $genre, search: $q) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear trailer { id site }
    }
  }
}`;

const TRENDING_Q = `query ($page: Int, $genre: String) {
  Page(page: $page, perPage: 20) {
    media(type: ANIME, isAdult: false, sort: [TRENDING_DESC], genre: $genre) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

const AIRING_Q = `query ($page: Int, $genre: String, $season: MediaSeason, $year: Int) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], genre: $genre, season: $season, seasonYear: $year) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

const UPCOMING_Q = `query ($page: Int, $genre: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], status: NOT_YET_RELEASED, genre: $genre) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

async function anilistList(q: string, vars: Record<string, any>): Promise<AnimeItem[]> {
  const data = await anilistQuery(q, vars);
  const media = data?.data?.Page?.media;
  if (media?.length) return deduplicate(media.map(transformAniList).filter(Boolean) as AnimeItem[]);
  return [];
}

export async function searchAnime(q: string, page = 1, genre?: string): Promise<AnimeItem[]> {
  const cleanQ = q.trim();
  if (!cleanQ) return [];

  const primary = await anilistList(LIST_Q, { page, q: cleanQ, genre: genre || null });
  if (primary.length) return primary;

  if (/[-_:'"\u0026]/.test(cleanQ)) {
    const altQ = cleanQ.replace(/[-_:'"\u0026]/g, " ").replace(/\s+/g, " ").trim();
    const alt = await anilistList(LIST_Q, { page, q: altQ, genre: genre || null });
    if (alt.length) return alt;
  }

  try {
    const k = await searchViaKitsu(cleanQ, page, genre);
    if (k?.length) return deduplicate(k);
  } catch {}
  return [];
}

export async function getPopularAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  const primary = await anilistList(LIST_Q, { page, genre: genre || null, q: null });
  if (primary.length) return primary;
  try {
    const k = await getPopularAnimeViaKitsu(page, genre);
    if (k?.length) return deduplicate(k);
  } catch {}
  return [];
}

export async function getTrendingAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  const primary = await anilistList(TRENDING_Q, { page, genre: genre || null });
  if (primary.length) return primary;
  try {
    const k = await getTrendingAnimeViaKitsu(page, genre);
    if (k?.length) return deduplicate(k);
  } catch {}
  return [];
}

export async function getAiringAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const now = new Date();
    const season = ["WINTER", "SPRING", "SUMMER", "FALL"][Math.floor(now.getMonth() / 3)];
    const primary = await anilistList(AIRING_Q, { page, genre: genre || null, season, year: now.getFullYear() });
    if (primary.length) return primary;
  } catch {}
  try {
    const k = await getAiringAnimeViaKitsu(page, genre);
    if (k?.length) return deduplicate(k);
  } catch {}
  return [];
}

export async function getUpcomingAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  const primary = await anilistList(UPCOMING_Q, { page, genre: genre || null });
  if (primary.length) return primary;
  try {
    const k = await getUpcomingAnimeViaKitsu(page, genre);
    if (k?.length) return deduplicate(k);
  } catch {}
  return [];
}

export async function getAnimeByGenre(genre: string, page = 1): Promise<AnimeItem[]> {
  return getPopularAnime(page, genre);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. CORE DETAIL PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

const MEDIA_Q = `query ($id: Int) {
  Media(id: $id, type: ANIME, isAdult: false) {
    id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
    episodes genres averageScore description status type format season seasonYear duration trailer { id site } nextAiringEpisode { episode airingAt timeUntilAiring }
    relations {
      edges { relationType node { id idMal title { romaji english native } episodes status season seasonYear format duration type isAdult bannerImage coverImage { large extraLarge } } }
    }
  }
}`;

export async function getAnimeDetails(
  id: string,
  epLimit = 100,
  skipEpisodes = false,
  depth = 0,
  visited: Set<string> = new Set<string>()
): Promise<AnimeDetailsResult | null> {
  const cleanId = String(id || "").trim().toLowerCase();
  if (!cleanId || depth > 1 || visited.has(cleanId)) {
    return null;
  }
  visited.add(cleanId);

  const cacheKey = `${id}-${epLimit}-${skipEpisodes}`;
  const cached = detailsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DETAILS_TTL) {
    return JSON.parse(JSON.stringify(cached.data));
  }

  function store(res: AnimeDetailsResult | null): AnimeDetailsResult | null {
    if (res?.anime) {
      if (detailsCache.size > 300) {
        const first = detailsCache.keys().next().value;
        if (first !== undefined) detailsCache.delete(first);
      }
      detailsCache.set(cacheKey, { data: res, timestamp: Date.now() });
    }
    return res;
  }

  // Handle kitsu-prefixed IDs
  if (id.startsWith("kitsu-")) {
    const kRes = await getAnimeDetailsViaKitsu(id, epLimit, skipEpisodes);
    if (kRes) return store(kRes);

    // Fallback: If direct Kitsu lookup returned null, check if the numeric part is an AniList or TMDB ID
    const rawClean = id.replace(/^kitsu-/, "").trim();
    const rawNum = parseInt(rawClean, 10);
    if (!isNaN(rawNum) && rawNum > 0 && depth < 1) {
      try {
        const azTmdb = await fetch(`https://api.ani.zip/mappings?themoviedb_id=${rawNum}`, {
          signal: AbortSignal.timeout(3000),
          headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
        }).then(r => r.ok ? r.json() : null).catch(() => null);

        if (azTmdb?.mappings?.anilist_id) {
          const targetId = String(azTmdb.mappings.anilist_id).trim();
          if (targetId.toLowerCase() !== cleanId && !visited.has(targetId.toLowerCase())) {
            const resolved = await getAnimeDetails(targetId, epLimit, skipEpisodes, depth + 1, visited);
            if (resolved) return store(resolved);
          }
        } else if (azTmdb?.mappings?.kitsu_id) {
          const resolved = await getAnimeDetailsViaKitsu(`kitsu-${azTmdb.mappings.kitsu_id}`, epLimit, skipEpisodes);
          if (resolved) return store(resolved);
        }
      } catch {}

      try {
        const azAl = await fetch(`https://api.ani.zip/mappings?anilist_id=${rawNum}`, {
          signal: AbortSignal.timeout(3000),
          headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
        }).then(r => r.ok ? r.json() : null).catch(() => null);

        if (azAl?.mappings) {
          const targetId = String(rawNum).trim();
          if (targetId.toLowerCase() !== cleanId && !visited.has(targetId.toLowerCase())) {
            const resolved = await getAnimeDetails(targetId, epLimit, skipEpisodes, depth + 1, visited);
            if (resolved) return store(resolved);
          }
        }
      } catch {}
    }
    return null;
  }

  // Resolve numeric AniList ID
  let numId = parseInt(id.replace(/^mal-/, ""), 10);

  if (id.startsWith("mal-") && !isNaN(numId)) {
    try {
      const r = await anilistQuery(`query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { id } }`, { idMal: numId });
      if (r?.data?.Media?.id) numId = r.data.Media.id;
    } catch {}
  }

  const curated = getFranchiseAnimeItem(id) || (!isNaN(numId) ? getFranchiseAnimeItem(numId) : null);
  if ((curated as any)?.anilist_id) numId = (curated as any).anilist_id;

  if (id.startsWith("tmdb-")) {
    const parts = id.split("-");
    const tmdbNum = parseInt(parts[1], 10);
    if (!isNaN(tmdbNum)) {
      const byTmdb = getFranchiseAnimeItem(tmdbNum);
      if ((byTmdb as any)?.anilist_id) numId = (byTmdb as any).anilist_id;
      else {
        try {
          const az = await fetch(`https://api.ani.zip/mappings?themoviedb_id=${tmdbNum}`, { signal: AbortSignal.timeout(2500), headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT }, next: { revalidate: 86400 } as any });
          if (az.ok) {
            const azData = await az.json();
            if (azData?.mappings?.anilist_id) numId = parseInt(String(azData.mappings.anilist_id), 10);
          }
        } catch {}
      }
    }
  }

  if (isNaN(numId)) {
    try {
      const r = await anilistQuery(`query ($s: String) { Media(search: $s, type: ANIME, isAdult: false) { id } }`, { s: id.replace(/[-_]/g, " ").trim() });
      if (r?.data?.Media?.id) numId = r.data.Media.id;
    } catch {}
  }

  if (isNaN(numId)) return store(await getAnimeDetailsViaKitsu(id, epLimit, skipEpisodes));

  // Parallel fetch: AniZip + AniList
  const [aniZip, media] = await Promise.all([
    fetch(`https://api.ani.zip/mappings?anilist_id=${numId}`, {
      signal: AbortSignal.timeout(3000),
      headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
      next: { revalidate: 86400 } as any,
    }).then(r => r.ok ? r.json() : null).catch(() => null),

    anilistQuery(MEDIA_Q, { id: numId }, 2, 86400).then((r: any) => r?.data?.Media || null).catch(() => null),
  ]);

  if (!media) {
    if (!isNaN(numId) && numId > 0 && depth < 1) {
      try {
        const azTmdb = await fetch(`https://api.ani.zip/mappings?themoviedb_id=${numId}`, {
          signal: AbortSignal.timeout(2500),
          headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
        }).then(r => r.ok ? r.json() : null).catch(() => null);

        if (azTmdb?.mappings?.anilist_id) {
          const targetId = String(azTmdb.mappings.anilist_id).trim();
          if (targetId.toLowerCase() !== cleanId && targetId !== String(numId) && !visited.has(targetId.toLowerCase())) {
            const resolved = await getAnimeDetails(targetId, epLimit, skipEpisodes, depth + 1, visited);
            if (resolved) return store(resolved);
          }
        } else if (azTmdb?.mappings?.kitsu_id) {
          const resolved = await getAnimeDetailsViaKitsu(`kitsu-${azTmdb.mappings.kitsu_id}`, epLimit, skipEpisodes);
          if (resolved) return store(resolved);
        }
      } catch {}
    }

    return store(await getAnimeDetailsViaKitsu(String(numId), epLimit, skipEpisodes));
  }

  const anime = transformAniList(media);
  if (!anime) return null;

  const isMovie = anime.format === "MOVIE" || anime.type === "MOVIE";

  // Resolve TMDB ID
  let tmdbId: number | null = (curated as any)?.tmdb_id || null;
  if (!tmdbId && aniZip?.mappings?.themoviedb_id) {
    const parsed = parseInt(String(aniZip.mappings.themoviedb_id), 10);
    if (!isNaN(parsed)) tmdbId = parsed;
  }
  if (!tmdbId) {
    try {
      tmdbId = isMovie
        ? await searchTmdbMovie(anime.name, anime.seasonYear || undefined) || (anime.jname ? await searchTmdbMovie(anime.jname, anime.seasonYear || undefined) : null)
        : await searchTmdbShow(anime.name, anime.seasonYear || undefined) || (anime.jname ? await searchTmdbShow(anime.jname, anime.seasonYear || undefined) : null);
    } catch { tmdbId = null; }
  }

  let aniZipEpisodeCount: number | null = null;
  if (aniZip?.episodes) {
    const keys = Object.keys(aniZip.episodes).map(Number).filter(k => !isNaN(k));
    if (keys.length) aniZipEpisodeCount = Math.max(...keys);
  }

  const resolvedMediaEpisodes = isMovie ? 1 : (
    (typeof media.episodes === "number" && media.episodes > 0 ? media.episodes : null) ||
    aniZipEpisodeCount ||
    (media.nextAiringEpisode?.episode ? media.nextAiringEpisode.episode - 1 : null) ||
    (anime.episodes?.sub && anime.episodes.sub > 0 ? anime.episodes.sub : null) ||
    (anime.status === "RELEASING" ? 1500 : 12)
  );

  anime.episodes = { sub: resolvedMediaEpisodes, dub: null };

  // Build franchise nodes + seasons
  let franchiseNodes = getFastFranchiseNodes(numId, media);
  const EXCLUDED = new Set([6922, 19165, 12565]);
  franchiseNodes = franchiseNodes.filter(n => !EXCLUDED.has(Number(n.id)));
  if (!franchiseNodes.length) {
    const n = toNode(media);
    if (n) {
      if (resolvedMediaEpisodes) n.episodes = resolvedMediaEpisodes;
      franchiseNodes = [n];
    }
  } else {
    const currentMediaNode = franchiseNodes.find(n => Number(n.id) === numId || String(n.id) === String(numId));
    if (currentMediaNode && (!currentMediaNode.episodes || currentMediaNode.episodes <= 1) && !isMovie) {
      currentMediaNode.episodes = resolvedMediaEpisodes;
      currentMediaNode.totalEpisodes = resolvedMediaEpisodes;
    }
  }

  const baseSeasons = buildSeasonList(franchiseNodes, numId);
  const tmdbSeasonMap: Record<string, number> = {};

  const mappedSeasons: SeasonInfo[] = baseSeasons.map(s => {
    const sIsMovie = (s.seasonLabel || "").startsWith("Movie") || isMovie;
    const isCurrentSeason = String(s.id) === String(numId);
    const tid = sIsMovie ? null : (s.tmdbId || tmdbId || null);
    let sNum: number | null = sIsMovie ? null : (s.tmdbSeasonNumber ?? null);
    let offset = sIsMovie ? 0 : (s.episodeOffset || 0);

    if (isCurrentSeason && aniZip?.episodes?.["1"]) {
      const ep1 = aniZip.episodes["1"];
      if (ep1.seasonNumber !== undefined && sNum === null) sNum = ep1.seasonNumber;
      if (ep1.episodeNumber !== undefined && offset === 0) offset = Math.max(ep1.episodeNumber - 1, 0);
    }
    if (!sIsMovie && sNum === null) {
      const parsed = parseSeasonNumberFromTitle(s.name);
      if (parsed) {
        sNum = parsed;
      } else if (s.seasonLabel) {
        const parsedLabel = parseSeasonNumberFromTitle(s.seasonLabel);
        if (parsedLabel) sNum = parsedLabel;
      } else if (isCurrentSeason) {
        sNum = 1;
      } else {
        sNum = null;
      }
    }
    if (tid && sNum !== null) tmdbSeasonMap[s.id] = sNum;

    return { ...s, tmdbId: tid, tmdbSeasonNumber: sNum, episodeOffset: offset, coverImage: s.coverImage || anime.poster, bannerImage: s.bannerImage || anime.bannerImage };
  });

  // Fetch TMDB logo + backdrop in parallel
  if (tmdbId) {
    try {
      const [imgRes, showData] = await Promise.all([
        tmdbFetch(`/${isMovie ? "movie" : "tv"}/${tmdbId}/images`, { include_image_language: "en,null,ja" }).catch(() => null),
        !anime.bannerImage ? tmdbFetch(`/${isMovie ? "movie" : "tv"}/${tmdbId}`).catch(() => null) : Promise.resolve(null),
      ]);
      const logos = (imgRes as any)?.logos || [];
      if (logos.length) {
        const logo = logos.find((l: any) => l.iso_639_1 === "en" && l.file_path)
          || logos.find((l: any) => !l.iso_639_1 && l.file_path)
          || logos[0];
        if (logo?.file_path) anime.logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
      }
      if ((showData as any)?.backdrop_path && !anime.bannerImage) {
        anime.backdrop = `https://image.tmdb.org/t/p/original${(showData as any).backdrop_path}`;
        anime.bannerImage = anime.backdrop;
      }
    } catch {}
  } else if (anime.bannerImage) {
    anime.backdrop = anime.bannerImage;
  }

  const activeSeason = mappedSeasons.find(s => String(s.id) === String(numId)) || mappedSeasons[0];
  const activeSeasonId = activeSeason ? String(activeSeason.id) : String(numId);

  if (skipEpisodes) {
    return store({ anime, episodes: [], totalEpisodes: activeSeason?.totalEpisodes || anime.episodes?.sub || 12, seasons: mappedSeasons, openedSeasonId: activeSeasonId, franchiseNodes, tmdbId, tmdbSeasonMap: Object.keys(tmdbSeasonMap).length ? tmdbSeasonMap : undefined });
  }

  // Fetch episodes for active season
  const cap = activeSeason?.totalEpisodes || anime.episodes?.sub || 12;
  let eps: EpisodeDetail[] = [];

  try {
    const azEps = await fetchEpisodesFromAniZip(activeSeasonId, cap);
    if (azEps?.length) eps = isMovie ? [azEps[0]] : azEps;
  } catch {}

  if (!eps.length) {
    try {
      const kEps = await fetchEpisodesFromKitsu(anime.name, cap);
      if (kEps?.length) {
        eps = kEps.map((k: any) => ({
          episodeId: `${activeSeasonId}-${k.episodeNum}`,
          episodeNum: k.episodeNum,
          title: k.title || `Episode ${k.episodeNum}`,
          description: k.description || null,
          thumbnail: k.thumbnail || null,
          releasedDate: k.releasedDate || null,
          isFiller: false, isRecap: false,
          seasonNum: 1, seasonId: activeSeasonId,
          seasonName: activeSeason?.name || anime.name,
        }));
      }
    } catch {}
  }

  if (!eps.length) {
    const count = isMovie ? 1 : Math.max(cap || 12, 1);
    for (let i = 1; i <= count; i++) {
      eps.push({ episodeId: `${activeSeasonId}-${i}`, episodeNum: i, title: isMovie ? (activeSeason?.name || anime.name || "Complete Movie") : `Episode ${i}`, description: isMovie ? anime.description || null : null, thumbnail: isMovie ? anime.poster || null : null, malUrl: null, releasedDate: null, isFiller: false, isRecap: false, seasonNum: 1, seasonId: activeSeasonId, seasonName: activeSeason?.name || anime.name });
    }
  }

  return store({ anime, episodes: eps, totalEpisodes: activeSeason?.totalEpisodes || eps.length, seasons: mappedSeasons, openedSeasonId: activeSeasonId, franchiseNodes, tmdbId, tmdbSeasonMap: Object.keys(tmdbSeasonMap).length ? tmdbSeasonMap : undefined });
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. EPISODE FETCHING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
const ANIZIP_CACHE = new Map<string, { data: any; timestamp: number }>();
const ANIZIP_TTL = 6 * 60 * 60 * 1000; // 6 hours

async function getRawAniZipData(param: string): Promise<any | null> {
  const cached = ANIZIP_CACHE.get(param);
  if (cached && Date.now() - cached.timestamp < ANIZIP_TTL) {
    return cached.data;
  }
  try {
    const res = await fetch(`https://api.ani.zip/mappings?${param}`, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
      next: { revalidate: 86400 } as any,
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json) {
      if (ANIZIP_CACHE.size > 500) {
        const first = ANIZIP_CACHE.keys().next().value;
        if (first !== undefined) ANIZIP_CACHE.delete(first);
      }
      ANIZIP_CACHE.set(param, { data: json, timestamp: Date.now() });
    }
    return json;
  } catch {
    return null;
  }
}

export async function fetchEpisodesFromAniZip(anilistId: string, seasonCap: number): Promise<EpisodeDetail[] | null> {
  try {
    const cleanId = String(anilistId || "").trim();
    const param = cleanId.startsWith("kitsu-") ? `kitsu_id=${cleanId.replace("kitsu-", "")}`
      : cleanId.startsWith("mal-") ? `mal_id=${cleanId.replace("mal-", "")}`
      : isNaN(Number(cleanId)) ? `kitsu_id=${cleanId}`
      : `anilist_id=${cleanId}`;

    const json = await getRawAniZipData(param);
    if (!json?.episodes) return null;

    const isMovie = (json.mappings?.type || "").toUpperCase() === "MOVIE";
    const maxEp = isMovie ? 1 : (seasonCap && seasonCap > 1 ? seasonCap : 1500);
    const eps: EpisodeDetail[] = [];

    for (const key of Object.keys(json.episodes)) {
      const num = parseInt(key, 10);
      if (isNaN(num) || num > maxEp) continue;
      const ep = json.episodes[key];
      eps.push({
        episodeId: `${anilistId}-${num}`,
        episodeNum: num,
        title: ep.title?.en || ep.title?.["x-jat"] || ep.title?.ja || `Episode ${num}`,
        description: ep.overview || ep.summary || null,
        thumbnail: ep.image && !ep.image.includes("/cover/") ? ep.image : null,
        releasedDate: ep.airDate || ep.airdate || null,
        isFiller: false, isRecap: false,
        malUrl: ep.malId ? `https://myanimelist.net/anime/${ep.malId}/episode/${num}` : null,
        runtime: typeof ep.duration === "number" ? Math.round(ep.duration / 60) : null,
      });
    }
    return eps.sort((a, b) => a.episodeNum - b.episodeNum);
  } catch {
    return null;
  }
}

export async function resolveTmdbMappingFromAniZip(anilistId: string): Promise<{ tmdbId: number; tmdbSeason: number; episodeOffset: number } | null> {
  try {
    const cleanId = String(anilistId || "").trim();
    const param = cleanId.startsWith("kitsu-") ? `kitsu_id=${cleanId.replace("kitsu-", "")}`
      : cleanId.startsWith("mal-") ? `mal_id=${cleanId.replace("mal-", "")}`
      : isNaN(Number(cleanId)) ? `kitsu_id=${cleanId}`
      : `anilist_id=${cleanId}`;

    const az = await getRawAniZipData(param);
    const tmdbId = parseInt(String(az?.mappings?.themoviedb_id || ""), 10);
    if (isNaN(tmdbId)) return null;
    const ep1 = az?.episodes?.["1"];
    let seasonNum = ep1?.seasonNumber;
    if (seasonNum === undefined && az?.episodes) {
      for (const k of Object.keys(az.episodes)) {
        if (az.episodes[k]?.seasonNumber !== undefined) {
          seasonNum = az.episodes[k].seasonNumber;
          break;
        }
      }
    }
    return { tmdbId, tmdbSeason: seasonNum ?? 1, episodeOffset: ep1?.episodeNumber ? Math.max(ep1.episodeNumber - 1, 0) : 0 };
  } catch { return null; }
}

// In-memory 24h cache for AFL results
const AFL_CACHE = new Map<string, { result: FillerLookup | null; expires: number }>();

// Canonical slug mapping for known long-running anime
const AFL_SLUG_MAP: Record<string, string> = {
  "naruto": "naruto",
  "naruto-shippuden": "naruto-shippuden",
  "naruto-shippuuden": "naruto-shippuden",
  "naruto-shippuden-naruto-shippuden": "naruto-shippuden",
  "bleach": "bleach",
  "bleach-thousand-year-blood-war": "bleach",
  "one-piece": "one-piece",
  "dragon-ball": "dragon-ball-z",
  "dragon-ball-z": "dragon-ball-z",
  "dragon-ball-super": "dragon-ball-super",
  "hunter-x-hunter-2011": "hunter-x-hunter-2011",
  "hunter-x-hunter": "hunter-x-hunter-2011",
  "fairy-tail": "fairy-tail",
  "attack-on-titan": "attack-on-titan",
  "shingeki-no-kyojin": "attack-on-titan",
  "boruto-naruto-next-generations": "boruto-naruto-next-generations",
  "boruto": "boruto-naruto-next-generations",
  "black-clover": "black-clover",
};

export async function fetchFillerLookupFromAnimeFillerList(animeName: string): Promise<FillerLookup | null> {
  let slug = (animeName || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  slug = slug.replace(/shippuuden/g, "shippuden");
  if (!slug) return null;

  // Apply canonical slug mapping
  const canonical = AFL_SLUG_MAP[slug] || slug;

  // Check in-memory cache
  const cached = AFL_CACHE.get(canonical);
  if (cached && cached.expires > Date.now()) return cached.result;

  try {
    const res = await fetch(`${FILLER_BASE}/${canonical}`, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
      next: { revalidate: 86400 } as any,
    });
    if (!res.ok) {
      AFL_CACHE.set(canonical, { result: null, expires: Date.now() + 3600_000 });
      return null;
    }
    const html = await res.text();
    const filler = new Set<number>();
    const mixed = new Set<number>();
    const rowRe = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(html))) {
      const cls = (m[1] || "").toLowerCase();
      if (!cls.includes("filler")) continue;
      const numM = m[2]?.match(/<td\b[^>]*>\s*(\d+)\s*<\/td>/i);
      if (numM) {
        const n = parseInt(numM[1], 10);
        // Only mark as mixed — pure filler rows don't contain "mixed"
        if (cls.includes("mixed")) mixed.add(n); else filler.add(n);
      }
    }
    const result = (filler.size || mixed.size) ? { filler, mixed } : null;
    AFL_CACHE.set(canonical, { result, expires: Date.now() + 86_400_000 });
    return result;
  } catch {
    AFL_CACHE.set(canonical, { result: null, expires: Date.now() + 3600_000 });
    return null;
  }
}

export async function fetchEpisodeThumbnail(malUrl: string): Promise<string | null> {
  try {
    const res = await fetch(malUrl, { signal: AbortSignal.timeout(4000), headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT } });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/https?:\/\/img\d\.ak\.crunchyroll\.com\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/i)
      || html.match(/data-src="([^"]+)"[^>]*width="800"/i)
      || html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    return m ? (m[1] || m[0]) : null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. ROUTE HANDLER HELPER
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAnimeApi(endpoint: string, isDetail = false): Promise<any> {
  const [path, qs] = endpoint.split("?");
  const params = new URLSearchParams(qs || "");
  const page = parseInt(params.get("page") || "1", 10);
  const genre = params.get("genre") || undefined;

  if (isDetail || path.startsWith("/series/")) {
    const id = path.replace("/series/", "").split("?")[0];
    const result = await getAnimeDetails(id);
    if (!result) throw new Error("Anime not found");
    return { success: true, data: { ...result.anime, episodes: result.episodes, totalEpisodes: result.totalEpisodes, seasons: result.seasons, openedSeasonId: result.openedSeasonId, franchiseNodes: result.franchiseNodes, tmdbId: result.tmdbId, tmdbSeasonMap: result.tmdbSeasonMap } };
  }

  if (path.includes("/search") || params.has("keyword") || params.has("q")) {
    return { success: true, data: await searchAnime(params.get("keyword") || params.get("q") || "", page, genre) };
  }

  return { success: true, data: await getPopularAnime(page, genre) };
}
