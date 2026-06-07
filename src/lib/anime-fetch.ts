// Multi-API Anime Fetcher
// Metadata: AniList (primary) + Jikan (fallback)
// Streaming: iframe embed sources only (no HLS)

import { isAdultContent } from "./content-filter";
import { tmdbFetch, searchTmdbShow, fetchTmdbEpisodeData } from "./tmdb";

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
}

const ANILIST_API = "https://graphql.anilist.co";
const JIKAN_BASE = "https://api.jikan.moe/v4";

function anilistQuery(query: string, variables: Record<string, any>): Promise<any> {
  return fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(8000),
  }).then((r) => r.json());
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
      episodes genres averageScore description status type format season seasonYear
    }
  }
}`;

const TRENDING_QUERY = `query ($page: Int, $genre: String) {
  Page(page: $page, perPage: 50) {
    media(
      type: ANIME,
      isAdult: false,
      sort: [TRENDING_DESC],
      genre: $genre
    ) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear
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
      episodes genres averageScore description status type format season seasonYear
    }
  }
}`;

// AniList relations query — fetches immediate neighbors
const RELATIONS_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal
    title { romaji english }
    episodes season seasonYear format
    relations {
      edges {
        node {
          id idMal
          title { romaji english }
          type episodes season seasonYear format isAdult
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

export async function searchAnime(query: string, page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(LIST_QUERY, { page, q: query, genre: genre || null });
    return deduplicateAnime((data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[]);
  } catch {
    return [];
  }
}

export async function getPopularAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(LIST_QUERY, { page, genre: genre || null, q: null });
    return deduplicateAnime((data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[]);
  } catch {
    return [];
  }
}

export async function getTrendingAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(TRENDING_QUERY, { page, genre: genre || null });
    return deduplicateAnime((data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[]);
  } catch {
    return [];
  }
}

export async function getAiringAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  const { season, year } = getCurrentSeason();
  try {
    const data = await anilistQuery(AIRING_QUERY, { page, genre: genre || null, season, year });
    return deduplicateAnime((data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[]);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FRANCHISE GRAPH TRAVERSAL
// ─────────────────────────────────────────────────────────────────────────────

// Relation types that constitute the same franchise
const FRANCHISE_RELATION_TYPES = new Set(["SEQUEL", "PREQUEL"]);
// These formats get included in the season list
const INCLUDABLE_FORMATS = new Set(["TV", "TV_SHORT", "OVA", "ONA", "SPECIAL", "MOVIE"]);

/**
 * Build the complete franchise graph using BFS from a given AniList ID.
 * Follows SEQUEL and PREQUEL edges to collect all related entries.
 * Returns all nodes discovered, sorted chronologically.
 */
async function buildFranchiseGraph(startId: number): Promise<FranchiseNode[]> {
  const visited = new Map<number, FranchiseNode>(); // id → node
  const queue: number[] = [startId];
  const MAX_NODES = 30; // safety cap — no franchise has 30+ entries in practice
  const MAX_HOPS = 12;
  let hops = 0;

  while (queue.length > 0 && visited.size < MAX_NODES && hops < MAX_HOPS) {
    // Process up to 3 nodes per hop in parallel to keep latency low
    const batch = queue.splice(0, 3);
    hops++;

    const results = await Promise.allSettled(
      batch.map(id => anilistQuery(RELATIONS_QUERY, { id }))
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const data = result.value?.data?.Media;
      if (!data) continue;

      const nodeId = data.id as number;
      if (!visited.has(nodeId)) {
        visited.set(nodeId, {
          id: nodeId,
          idMal: data.idMal || null,
          title: data.title?.english || data.title?.romaji || "",
          episodes: data.episodes || null,
          season: data.season || null,
          seasonYear: data.seasonYear || null,
          format: data.format || null,
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
            title: node.title?.english || node.title?.romaji || "",
            episodes: node.episodes || null,
            season: node.season || null,
            seasonYear: node.seasonYear || null,
            format: node.format || null,
          });
          // Also queue it so we fetch its own relations (to continue the chain)
          if (visited.size < MAX_NODES) {
            queue.push(neighborId);
          }
        }
      }
    }

    // Small delay between hops to be nice to AniList rate limits
    if (queue.length > 0 && hops > 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return [...visited.values()];
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

  return includable.map(node => {
    const isMovie = node.format === "MOVIE";
    const isSpecial = node.format === "SPECIAL";
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
      : Math.max(node.episodes || 12, 1);

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
}

/**
 * Build season list from TMDB show data.
 * Uses TMDB season structure as the source of truth.
 * Each TMDB season becomes a SeasonInfo entry.
 * Tries to match TMDB seasons to AniList franchise nodes by position.
 */
async function buildSeasonsFromTmdb(
  tmdbId: number,
  franchiseNodes: FranchiseNode[],
  currentId: number
): Promise<{ seasons: SeasonInfo[]; tmdbSeasonMap: Record<string, number> }> {
  const showData = await tmdbFetch(`/tv/${tmdbId}`) as {
    seasons?: { season_number: number; name: string; episode_count: number; overview?: string }[];
  } | null;

  const tmdbSeasons = showData?.seasons || [];
  const sorted = tmdbSeasons
    .filter(s => s.season_number >= 0 && (s.episode_count || 0) > 0)
    .sort((a, b) => a.season_number - b.season_number);

  const seasons: SeasonInfo[] = [];
  const tmdbSeasonMap: Record<string, number> = {};

  // TV entries from AniList, ordered by air date, for matching
  const tvNodes = franchiseNodes
    .filter(n => n.format === "TV" || n.format === "TV_SHORT" || n.format === "ONA")
    .sort((a, b) => {
      const yearA = a.seasonYear || 9999;
      const yearB = b.seasonYear || 9999;
      if (yearA !== yearB) return yearA - yearB;
      const seasonOrder = ["WINTER", "SPRING", "SUMMER", "FALL"];
      return seasonOrder.indexOf(a.season || "FALL") - seasonOrder.indexOf(b.season || "FALL");
    });

  for (const tmdbSeason of sorted) {
    const seasonNum = tmdbSeason.season_number;
    // TMDB season 0 is "Specials", handle it as a special section
    const label = seasonNum === 0 ? "Specials" : `Season ${seasonNum}`;
    const epCount = tmdbSeason.episode_count || 0;

    // Match TMDB season to an AniList node by position
    // TMDB season N → Nth TV entry in the AniList franchise
    let node: FranchiseNode | null = null;
    if (seasonNum > 0 && seasonNum - 1 < tvNodes.length) {
      node = tvNodes[seasonNum - 1];
    }

    const seasonId = node ? String(node.id) : `tmdb-${tmdbId}-s${seasonNum}`;

    seasons.push({
      id: seasonId,
      name: tmdbSeason.name || label,
      seasonLabel: label,
      totalEpisodes: Math.max(epCount, 1),
      isCurrent: node ? node.id === currentId : seasonNum === 1,
      idMal: node?.idMal || null,
      seasonYear: node?.seasonYear || null,
      tmdbSeasonNumber: seasonNum,
    });

    tmdbSeasonMap[seasonId] = seasonNum;
  }

  return { seasons, tmdbSeasonMap };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER-SIDE CACHE
// ─────────────────────────────────────────────────────────────────────────────

const animeDetailCache = new Map<string, { data: any; expires: number }>();
function getCachedDetail(key: string) {
  const cached = animeDetailCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  return null;
}
function setCachedDetail(key: string, data: any) {
  animeDetailCache.set(key, { data, expires: Date.now() + 300000 }); // 5 min TTL
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
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;

  const cacheKey = `independent:${id}:${epLimit}:${skipEpisodes}`;
  const cached = getCachedDetail(cacheKey);
  if (cached) return cached;

  // Step 1: Fetch main media metadata for the requested ID
  let media: any = null;
  try {
    const q = `query ($id: Int) {
      Media(id: $id, type: ANIME, isAdult: false) {
        id idMal isAdult title { romaji english native } coverImage { large extraLarge }
        episodes genres averageScore description status type format season seasonYear
      }
    }`;
    const data = await anilistQuery(q, { id: numId });
    media = data?.data?.Media;
  } catch {
    // AniList failed — try Jikan fallback
  }

  // Jikan fallback for the main metadata (use ONLY if we have valid MAL ID)
  if (!media) {
    try {
      const jikanRes = await fetch(
        `${JIKAN_BASE}/anime/${numId}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (jikanRes.ok) {
        const jData = await jikanRes.json();
        const a = jData.data;
        if (a && a.rating !== "rx") {
          const totalEps = Math.max(a.episodes || 12, 1);
          let episodes: EpisodeDetail[] = [];
          if (!skipEpisodes) {
            const realEps = await fetchEpisodesFromJikan(numId, String(numId), Math.min(totalEps, epLimit));
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
            id: String(a.mal_id), idMal: String(a.mal_id),
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
            id: String(a.mal_id), name: animeItem.name,
            seasonLabel: "Episodes", totalEpisodes: totalEps,
            isCurrent: true, idMal: a.mal_id,
          };
          // Validate
          const val = validateSeason(jikanSeason, animeItem.name, []);
          if (val.warnings.length > 0) {
            console.warn(`[Validation] Jikan fallback season warnings for ${id}:`, val.warnings);
          }
          const jikanResult = {
            anime: animeItem, episodes, totalEpisodes: totalEps,
            seasons: [jikanSeason], openedSeasonId: id,
            franchiseNodes: [] as FranchiseNode[],
            tmdbId: null,
            tmdbSeasonMap: undefined,
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

  // Step 2: Build the franchise graph to find all related entries
  let franchiseNodes: FranchiseNode[] = [];
  try {
    franchiseNodes = await buildFranchiseGraph(numId);
  } catch {
    // If franchise graph fails, continue with just this entry
  }

  // Ensure current media is in the graph
  const currentInGraph = franchiseNodes.find(n => n.id === numId);
  if (!currentInGraph) {
    franchiseNodes.push({
      id: numId,
      idMal: media.idMal || null,
      title: anime.name,
      episodes: media.episodes || null,
      season: media.season || null,
      seasonYear: media.seasonYear || null,
      format: media.format || null,
    });
  }

  // Step 2.5: Search TMDB for the anime to use as primary season structure
  let tmdbId: number | null = null;
  let tmdbSeasonMap: Record<string, number> = {};
  try {
    tmdbId = await searchTmdbShow(anime.name, anime.seasonYear || undefined);
    if (!tmdbId && anime.jname) {
      tmdbId = await searchTmdbShow(anime.jname, anime.seasonYear || undefined);
    }
  } catch {
    tmdbId = null;
  }

  // Step 3: Build season list — prefer TMDB structure when available
  let seasons: SeasonInfo[];
  if (tmdbId) {
    try {
      const tmdbResult = await buildSeasonsFromTmdb(tmdbId, franchiseNodes, numId);
      seasons = tmdbResult.seasons;
      tmdbSeasonMap = tmdbResult.tmdbSeasonMap;
    } catch {
      // Fall back to AniList-based season building if TMDB fails
      seasons = buildSeasonList(franchiseNodes, numId);
      tmdbId = null;
    }
  } else {
    seasons = buildSeasonList(franchiseNodes, numId);
  }

  // Step 4: Find the opened season (the one matching the requested ID)
  const openedSeasonIndex = seasons.findIndex(s => s.id === id);
  const openedSeason = seasons[openedSeasonIndex >= 0 ? openedSeasonIndex : 0];
  const activeSeasonId = openedSeason?.id || id;

  // Validate all seasons
  for (const s of seasons) {
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
      seasons,
      openedSeasonId: activeSeasonId,
      franchiseNodes,
      tmdbId,
      tmdbSeasonMap: Object.keys(tmdbSeasonMap).length > 0 ? tmdbSeasonMap : undefined,
    };
    setCachedDetail(cacheKey, skipResult);
    return skipResult;
  }

  // Step 6: Fetch real episodes for the active season
  const allCombinedEpisodes: EpisodeDetail[] = [];
  const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => openedSeason.seasonLabel.startsWith(t));
  const maxEp = isSpecialFormat ? Math.max(openedSeason.totalEpisodes, 1) : Math.max(openedSeason.totalEpisodes, 1);
  const seasonCap = Math.min(maxEp, epLimit);
  let seasonEps: EpisodeDetail[] = [];

  if (openedSeason.idMal) {
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
    seasons,
    openedSeasonId: activeSeasonId,
    franchiseNodes,
    tmdbId,
    tmdbSeasonMap: Object.keys(tmdbSeasonMap).length > 0 ? tmdbSeasonMap : undefined,
  };
  setCachedDetail(cacheKey, fullResult);
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
      id: String(a.mal_id),
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
    let page = 1;
    let hasMore = true;
    let retries = 0;

    while (hasMore && allEps.length < maxEpisodes) {
      const res = await fetch(
        `${JIKAN_BASE}/anime/${malId}/episodes?page=${page}`,
        { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "CineStream/1.0" } }
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

      const totalPages = data.pagination?.last_visible_page || page;
      hasMore = page < totalPages && allEps.length < maxEpisodes;
      page++;
      if (hasMore) await new Promise(r => setTimeout(r, 350));
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
        { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "CineStream/1.0" } }
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

// In-memory thumbnail cache (keyed by MAL episode URL)
const thumbnailCache = new Map<string, string>();

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
  if (thumb) thumbnailCache.set(malUrl, thumb);
  return thumb;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY fetchAnimeApi (used by main API route)
// ─────────────────────────────────────────────────────────────────────────────

const detailCache = new Map<string, { data: any; expires: number }>();
const listCache = new Map<string, { data: any; expires: number }>();

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
        },
      };
      detailCache.set(cacheKeyDetail, { data: response, expires: Date.now() + 300000 });
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
    let items = await searchAnime(keyword, page, genre);
    if (items.length === 0) {
      items = await searchViaJikan(keyword);
    }
    result = { success: true, data: items.filter((item) => !isAdultContent(item.name, item.genres, item.description)) };
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
  }

  return result;
}
