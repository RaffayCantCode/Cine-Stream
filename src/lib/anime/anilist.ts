// AniList server client — cached, deterministic, edge-safe.
// Canonical source for identity, status, episode counts, genres, format,
// season/year, description, trailer and next-airing info.

import { isAdultContent } from "@/lib/content-filter";
import { getCuratedAnimeFranchiseNodes } from "@/lib/franchises";
import type {
  AnimeCore,
  AnimeItem,
  FranchiseNode,
  NextAiringEpisode,
  SeasonInfo,
} from "./types";
import { searchJikan } from "./jikan";

const ANILIST_API = "https://graphql.anilist.co";
const ANILIST_USER_AGENT = "CineStream/1.0 (https://github.com/RaffayCantCode/Cine-Stream)";
const ANILIST_REVALIDATE = 86400; // 24h

const CORE_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME, isAdult: false) {
    id idMal isAdult
    title { romaji english native }
    description
    coverImage { large extraLarge }
    bannerImage
    episodes genres averageScore
    status type format season seasonYear duration
    trailer { id site }
    nextAiringEpisode { episode airingAt timeUntilAiring }
  }
}`;

const CORE_BY_MAL_QUERY = `query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME, isAdult: false) {
    id idMal isAdult
    title { romaji english native }
    description
    coverImage { large extraLarge }
    bannerImage
    episodes genres averageScore
    status type format season seasonYear duration
    trailer { id site }
    nextAiringEpisode { episode airingAt timeUntilAiring }
  }
}`;

const ID_BY_MAL_QUERY = `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { id } }`;
const ID_BY_SEARCH_QUERY = `query ($search: String) { Media(search: $search, type: ANIME, isAdult: false) { id } }`;

const ID_MAL_BY_IDS_QUERY = `query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: ANIME, isAdult: false) {
      id idMal
    }
  }
}`;

const IDS_BY_MAL_QUERY = `query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(idMal_in: $ids, type: ANIME, isAdult: false) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

const LIST_QUERY = `query ($page: Int, $genre: String, $q: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], genre: $genre, search: $q) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear trailer { id site }
    }
  }
}`;

const SEARCH_QUERY = `query ($page: Int, $genre: String, $q: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, genre: $genre, search: $q) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear trailer { id site }
    }
  }
}`;

const TRENDING_QUERY = `query ($page: Int, $genre: String) {
  Page(page: $page, perPage: 20) {
    media(type: ANIME, isAdult: false, sort: [TRENDING_DESC, POPULARITY_DESC], genre: $genre) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

const MOVIE_QUERY = `query ($page: Int, $genre: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, format: MOVIE, isAdult: false, sort: [POPULARITY_DESC], genre: $genre) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

const AIRING_QUERY = `query ($page: Int, $genre: String, $season: MediaSeason, $year: Int) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], genre: $genre, season: $season, seasonYear: $year) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

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

export async function anilistQuery(
  query: string,
  variables: Record<string, unknown>,
  opts: { retries?: number; revalidate?: number; timeoutMs?: number } = {}
): Promise<any | null> {
  const { retries = 2, revalidate = ANILIST_REVALIDATE, timeoutMs = 8000 } = opts;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ANILIST_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": ANILIST_USER_AGENT,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429) {
        if (attempt < retries) {
          const retryAfter = res.headers.get("retry-after");
          const delay = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 10000) : 1500 * (attempt + 1);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

function stripHtml(value: string | null | undefined): string {
  return (value || "").replace(/<[^>]*>/g, "").trim();
}

function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/** Normalize AniList status. Never downgrade FINISHED. */
function normalizeStatus(status: string | null | undefined, nextAiring?: NextAiringEpisode | null): string | null {
  if (!status) return null;
  if (status === "FINISHED" || status === "FINISHED_AIRING") return "FINISHED";
  if (status === "NOT_YET_RELEASED" || status === "NOT_YET_AIRED") {
    if (nextAiring) return "RELEASING";
    return "NOT_YET_RELEASED";
  }
  return status;
}

export function transformAnimeCore(media: any): AnimeCore | null {
  if (!media || media.isAdult) return null;
  const title = media.title || {};
  const nextAiring: NextAiringEpisode | null = media.nextAiringEpisode
    ? {
        episode: media.nextAiringEpisode.episode,
        airingAt: media.nextAiringEpisode.airingAt,
        timeUntilAiring: media.nextAiringEpisode.timeUntilAiring,
      }
    : null;
  return {
    id: String(media.id),
    idMal: media.idMal ? String(media.idMal) : null,
    name: title.english || title.romaji || title.native || "Anime",
    jname: title.native || null,
    poster: media.coverImage?.extraLarge || media.coverImage?.large || "",
    bannerImage: media.bannerImage || null,
    description: stripHtml(media.description),
    type: media.format || media.type || "TV",
    rating: media.averageScore ? String((media.averageScore / 10).toFixed(1)) : null,
    status: normalizeStatus(media.status, nextAiring),
    genres: Array.isArray(media.genres) ? media.genres : [],
    totalEpisodes: toNum(media.episodes),
    season: media.season || null,
    seasonYear: media.seasonYear || null,
    format: media.format || null,
    duration: toNum(media.duration),
    trailerId: media.trailer?.site === "youtube" ? media.trailer.id : null,
    nextAiringEpisode: nextAiring,
  };
}

export async function getAnimeCore(id: number): Promise<AnimeCore | null> {
  const data = await anilistQuery(CORE_QUERY, { id }, { retries: 1 });
  return transformAnimeCore(data?.data?.Media);
}

export async function getAnimeIdByMal(malId: number): Promise<number | null> {
  const data = await anilistQuery(ID_BY_MAL_QUERY, { idMal: malId }, { timeoutMs: 3000 });
  const id = data?.data?.Media?.id;
  return typeof id === "number" ? id : null;
}

export async function getAnimeIdBySearch(title: string): Promise<number | null> {
  const data = await anilistQuery(ID_BY_SEARCH_QUERY, { search: title }, { timeoutMs: 3000 });
  const id = data?.data?.Media?.id;
  return typeof id === "number" ? id : null;
}

/**
 * Convert Jikan (MAL-id) search results into canonical AniList items.
 * Batch-resolves MAL -> AniList via idMal_in and DROPS any entry AniList
 * cannot resolve, so every item returned is guaranteed to open on AniList.
 */
async function resolveJikanToAniList(jikanItems: AnimeItem[]): Promise<AnimeItem[]> {
  if (jikanItems.length === 0) return [];
  const malIds = jikanItems
    .map((item) => (item.idMal ? parseInt(item.idMal, 10) : NaN))
    .filter((n) => !Number.isNaN(n));
  if (malIds.length === 0) return [];

  const data = await anilistQuery(IDS_BY_MAL_QUERY, { ids: malIds.slice(0, 50) }, { retries: 1 });
  const byMal = new Map<number, any>();
  for (const media of data?.data?.Page?.media || []) {
    if (typeof media.idMal === "number") byMal.set(media.idMal, media);
  }

  const items: AnimeItem[] = [];
  const seen = new Set<string>();
  for (const jikanItem of jikanItems) {
    const malId = jikanItem.idMal ? parseInt(jikanItem.idMal, 10) : NaN;
    const media = !Number.isNaN(malId) ? byMal.get(malId) : null;
    if (!media) continue; // Unresolvable on AniList — would show "not found".
    const item = transformAnimeItem(media);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// BROWSE / SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export function transformAnimeItem(media: any): AnimeItem | null {
  if (!media || media.isAdult) return null;
  const core = transformAnimeCore(media);
  if (!core) return null;
  return {
    ...core,
    episodes: { sub: core.totalEpisodes, dub: null },
  };
}

function deduplicateAnime(items: AnimeItem[]): AnimeItem[] {
  const seen = new Set<string>();
  const seenMal = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    if (item.idMal) {
      if (seenMal.has(item.idMal)) return false;
      seenMal.add(item.idMal);
    }
    return true;
  });
}

function filterUnreleased(items: AnimeItem[]): AnimeItem[] {
  return items.filter((item) => {
    const s = item.status;
    if (!s) return true;
    if (s === "CANCELLED" || s === "Cancelled") return false;
    return true;
  });
}

function getCurrentSeason() {
  const now = new Date();
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  return {
    season: seasons[Math.floor(now.getMonth() / 3)],
    year: now.getFullYear(),
  };
}

export async function browseAnime(
  category: string,
  page = 1,
  genre = "",
  q = ""
): Promise<{ items: AnimeItem[]; hasMore: boolean }> {
  const cleanQ = q.trim();

  if (category === "search" || cleanQ) {
    const data = await anilistQuery(SEARCH_QUERY, { page, q: cleanQ, genre: genre || null }, { retries: 1 });
    let items = ((data?.data?.Page?.media || []) as any[]).map(transformAnimeItem).filter(Boolean) as AnimeItem[];

    if (items.length === 0) {
      // Jikan fallback — batch-verified so only openable entries are returned.
      const jikanItems = await searchJikan(cleanQ);
      items = await resolveJikanToAniList(jikanItems);
    }
    const result = filterUnreleased(deduplicateAnime(items)).filter(
      (item) => !isAdultContent(item.name, item.genres, item.description)
    );
    return { items: result, hasMore: result.length > 0 };
  }

  let query = LIST_QUERY;
  let variables: Record<string, unknown> = { page, genre: genre || null, q: null };
  if (category === "trending") {
    query = TRENDING_QUERY;
    variables = { page, genre: genre || null };
  } else if (category === "movie") {
    query = MOVIE_QUERY;
    variables = { page, genre: genre || null };
  } else if (category === "airing") {
    query = AIRING_QUERY;
    const { season, year } = getCurrentSeason();
    variables = { page, genre: genre || null, season, year };
  }

  const data = await anilistQuery(query, variables, { retries: 1 });
  const items = ((data?.data?.Page?.media || []) as any[]).map(transformAnimeItem).filter(Boolean) as AnimeItem[];
  const result = filterUnreleased(deduplicateAnime(items)).filter(
    (item) => !isAdultContent(item.name, item.genres, item.description)
  );
  return { items: result, hasMore: result.length > 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// FRANCHISE GRAPH + SEASON LIST
// ─────────────────────────────────────────────────────────────────────────────

const FRANCHISE_RELATION_TYPES = new Set(["SEQUEL", "PREQUEL", "ALTERNATIVE", "PARENT", "SIDE_STORY", "SPIN_OFF"]);
const INCLUDABLE_FORMATS = new Set(["TV", "TV_SHORT", "OVA", "ONA", "SPECIAL", "MOVIE"]);
const SEASON_ORDER = ["WINTER", "SPRING", "SUMMER", "FALL"];

function makeFranchiseNode(data: any): FranchiseNode | null {
  if (!data || data.isAdult) return null;
  return {
    id: data.id,
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
  };
}

/**
 * Curated franchise entries (franchises.ts) never carry a MAL ID, but the
 * Jikan filler/recap enrichment (catalog.ts) depends on it. Batch-resolve
 * idMal from AniList so filler tags render on curated shows (Naruto Shippuden,
 * Bleach TYBW, Jujutsu Kaisen, etc.).
 */
async function enrichCuratedIdMal(nodes: FranchiseNode[]): Promise<FranchiseNode[]> {
  const missing = nodes.filter((n) => !n.idMal);
  if (missing.length === 0) return nodes;

  const idMalById = new Map<number, number>();
  const ids = missing.map((n) => n.id);
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const res = await anilistQuery(ID_MAL_BY_IDS_QUERY, { ids: chunk }, { retries: 1, timeoutMs: 5000 });
    for (const m of res?.data?.Page?.media || []) {
      if (typeof m?.idMal === "number") idMalById.set(m.id, m.idMal);
    }
  }

  return nodes.map((n) => (n.idMal ? n : { ...n, idMal: idMalById.get(n.id) ?? null }));
}

export async function fetchFranchiseGraph(startId: number): Promise<FranchiseNode[]> {
  const curated = getCuratedAnimeFranchiseNodes(startId);
  if (curated && curated.length > 1) {
    return enrichCuratedIdMal(curated as FranchiseNode[]);
  }

  const visited = new Map<number, FranchiseNode>();

  const addNode = (data: any) => {
    const node = makeFranchiseNode(data);
    if (node && !visited.has(node.id)) visited.set(node.id, node);
  };

  const collectRelationIds = (media: any): number[] => {
    const ids: number[] = [];
    const edges = media?.relations?.edges || [];
    for (const edge of edges) {
      const node = edge?.node;
      const relType: string = edge?.relationType || "";
      if (!FRANCHISE_RELATION_TYPES.has(relType)) continue;
      if (node?.type !== "ANIME" || node?.isAdult) continue;
      const nid = node.id as number;
      if (typeof nid !== "number") continue;
      if (!visited.has(nid)) {
        const stub = makeFranchiseNode(node);
        if (stub) visited.set(nid, stub);
        ids.push(nid);
      }
    }
    return ids;
  };

  try {
    const level1 = await anilistQuery(RELATIONS_SINGLE_QUERY, { id: startId }, { retries: 1 });
    const rootMedia = level1?.data?.Media;
    if (!rootMedia) return [];

    addNode(rootMedia);
    let toFetch = collectRelationIds(rootMedia);
    let depth = 0;

    while (toFetch.length > 0 && depth < 6 && visited.size < 120) {
      depth++;
      const batchIds = toFetch.splice(0, 50);
      try {
        const batchRes = await anilistQuery(BATCH_RELATIONS_QUERY, { ids: batchIds }, { retries: 1 });
        const medias = batchRes?.data?.Page?.media || [];
        for (const media of medias) {
          addNode(media);
          toFetch.push(...collectRelationIds(media));
        }
      } catch {
        break;
      }
    }
  } catch {
    return [];
  }

  return [...visited.values()].filter((n) => n.title);
}

const FORMAT_ORDER: Record<string, number> = { TV: 0, TV_SHORT: 1, ONA: 2, OVA: 3, SPECIAL: 4, MOVIE: 5 };

export function sortNodesChronologically(nodes: FranchiseNode[]): FranchiseNode[] {
  // Stable sort (Array#sort is stable): nodes with an unknown seasonYear keep
  // their relative position instead of being dumped at the end. Curated
  // franchises are hand-ordered by release, so a missing year must NOT reorder
  // them (e.g. JJK 0 movie must stay right after Season 1).
  return [...nodes].sort((a, b) => {
    const ya = a.seasonYear;
    const yb = b.seasonYear;
    if (ya == null || yb == null) return 0;
    if (ya !== yb) return ya - yb;
    const fA = FORMAT_ORDER[a.format || "TV"] ?? 6;
    const fB = FORMAT_ORDER[b.format || "TV"] ?? 6;
    if (fA !== fB) return fA - fB;
    const sA = SEASON_ORDER.indexOf(a.season || "FALL");
    const sB = SEASON_ORDER.indexOf(b.season || "FALL");
    return sA - sB;
  });
}

/** Strip season/part markers and punctuation to get a series' base title. */
function normalizeTitleBase(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(?season\s*\d+\)?/g, "")
    .replace(/\d+(?:st|nd|rd|th)\s+season\b/g, "")
    .replace(/\bfinal season\b/g, "")
    .replace(/\b(?:part|cour)\s*\d+\b/g, "")
    .replace(/[()[\]{}:,.!?;'"/\\\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Season 4", "4th Season", "2nd Season Part 2" -> the season number. */
function extractSeasonOrdinal(title: string): number | null {
  const m = title.toLowerCase().match(/(?:season\s*(\d+)|(\d+)(?:st|nd|rd|th)\s+season)/);
  if (!m) return null;
  const n = parseInt(m[1] || m[2], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * True when a node belongs to the same main-line series as the anchored entry.
 * An exact base match counts, and so do plain name extensions ("Naruto" ->
 * "Naruto: Shippuden"). A colon-subtitle with EXTRA words after the franchise
 * name ("One Piece Log: Fish-Man Island Saga", "Tensura: Sukuwareru Ramiris")
 * is a spin-off; a colon whose prefix IS the franchise name ("Naruto:
 * Shippuden") is a real continuation.
 */
function isSameSeries(title: string, rootBase: string): boolean {
  const base = normalizeTitleBase(title);
  if (!base || !rootBase) return true;
  if (base === rootBase) return true;
  const lower = title.toLowerCase();
  const colonIdx = lower.indexOf(":");
  const prefix = colonIdx > 0 ? lower.slice(0, colonIdx).trim() : "";
  if (colonIdx > 0 && prefix !== rootBase && prefix.length >= 6) return false;
  return base.startsWith(rootBase) || rootBase.startsWith(base);
}

/** Build a SeasonInfo list from franchise nodes (chronological, labelled). */
export function buildSeasonList(nodes: FranchiseNode[], currentId: number): SeasonInfo[] {
  const includable = nodes.filter((n) => n.format && INCLUDABLE_FORMATS.has(n.format));
  const sorted = sortNodesChronologically(includable);

  // Anchor the "main line" on the earliest-dated series in the franchise (the
  // franchise's root) so later entries with a different title base still match
  // (Bleach original vs TYBW). Side-stories/OVAs/specials are never counted
  // toward "Season N".
  const isSeriesNode = (n: FranchiseNode) =>
    n.format === "TV" || n.format === "TV_SHORT" || (n.format === "ONA" && (n.episodes || 1) > 1);
  const opened = sorted.find((n) => n.id === currentId) || sorted[0];
  const anchor = sorted.find(isSeriesNode) || opened;
  const rootBase = normalizeTitleBase(anchor?.title || "");

  let tvCount = 0;
  let movieCount = 0;
  let ovaCount = 0;
  let specialCount = 0;

  const mapped = sorted.map((node) => {
    const isShortMovie =
      node.format === "MOVIE" &&
      (node.episodes || 1) <= 1 &&
      (node.duration || 0) > 0 &&
      (node.duration || 0) < 40;
    const isMovie = node.format === "MOVIE" && !isShortMovie;
    const isSingleEpisode = (node.episodes || 1) <= 1;
    const sameMainSeries = isSameSeries(node.title, rootBase);
    const lowerTitle = node.title.toLowerCase();
    const isSideStoryTitle =
      (lowerTitle.includes("hitorigoto") && !lowerTitle.includes("kusuriya")) ||
      lowerTitle.includes("chibi") ||
      lowerTitle.includes("mini anime") ||
      lowerTitle.includes("petit");

    // A node is a special / side-story if:
    // 1) format is SPECIAL or OVA
    // 2) short movie
    // 3) single-episode ONA
    // 4) explicit side-story mini-series (like Maomao no Hitorigoto)
    const isSpecial =
      node.format === "SPECIAL" ||
      isShortMovie ||
      isSideStoryTitle ||
      (node.format === "ONA" && (isSingleEpisode || !sameMainSeries));
    const isActualOva = node.format === "OVA";
    const isTv = !isMovie && !isActualOva && !isSpecial;

    let label = node.seasonLabel || "";
    if (!label) {
      if (isMovie) {
        movieCount++;
        label = `Movie ${movieCount}`;
      } else if (isActualOva) {
        ovaCount++;
        label = `OVA ${ovaCount}`;
      } else if (isSpecial) {
        specialCount++;
        label = `Special ${specialCount}`;
      } else {
        const lowerTitle = node.title.toLowerCase();
        // Explicit ordinal in the title wins ("4th Season" -> Season 4), so
        // side-stories that share the franchise name never inflate numbering.
        const ordinal = extractSeasonOrdinal(node.title);
        if (ordinal !== null) {
          tvCount = Math.max(tvCount, ordinal);
          const partMatch = lowerTitle.match(/(?:part|cour)\s*(\d+)/i);
          label = partMatch ? `Season ${ordinal} Part ${partMatch[1]}` : `Season ${ordinal}`;
        } else if (lowerTitle.includes("final season")) {
          tvCount = Math.max(tvCount, 4);
          const partMatch = lowerTitle.match(/(?:part|cour)\s*(\d+)/i);
          label = partMatch ? `Final Season Part ${partMatch[1]}` : "Final Season";
        } else if (isSameSeries(node.title, rootBase)) {
          tvCount++;
          label = `Season ${tvCount}`;
        } else {
          specialCount++;
          label = `Special ${specialCount}`;
        }
      }
    }

    const totalEp =
      isMovie || isActualOva || isSpecial ? Math.max(node.episodes || 1, 1) : node.episodes ? Math.max(node.episodes, 1) : 0;

    let nodeStatus = node.status || "";
    if (!nodeStatus) {
      if (node.seasonYear && node.seasonYear > new Date().getFullYear()) {
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
      format: node.format,
      tmdbId: node.tmdbId || null,
      tmdbSeasonNumber: node.tmdbSeasonNumber ?? null,
      episodeOffset: node.episodeOffset || 0,
      coverImage: node.coverImage || null,
      bannerImage: node.bannerImage || null,
    };
  });

  // Keep the current season plus all TV/movie entries; specials and OVAs are
  // kept too but are surfaced in the UI under a separate collapsible
  // "Specials" section (never merged inline with the main episode list).
  return mapped.filter((season) => {
    if (season.isCurrent) return true;
    if (season.seasonLabel.startsWith("Season") || season.seasonLabel.startsWith("Movie")) return true;
    if (season.seasonLabel.startsWith("Special") || season.seasonLabel.startsWith("OVA")) return true;
    const lowerName = season.name.toLowerCase();
    const plotKeywords = ["final", "part", "chapter", "season", "arc", "prologue", "epilogue"];
    if (plotKeywords.some((kw) => lowerName.includes(kw))) return true;
    return false;
  });
}
