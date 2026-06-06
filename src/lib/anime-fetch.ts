// Multi-API Anime Fetcher
// Metadata: AniList (primary) + Jikan (fallback)
// Streaming: iframe embed sources only (no HLS)

import { isAdultContent } from "./content-filter";

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

// Group anime by franchise (normalized title) — keeps only the first/most relevant entry per franchise
function groupByFranchise(items: AnimeItem[]): AnimeItem[] {
  const grouped = new Map<string, AnimeItem>();
  for (const item of items) {
    const normalized = item.name
      .replace(/\s*season\s+\d+/gi, '')
      .replace(/\s*part\s+\d+/gi, '')
      .replace(/\s*(?:final|first|second|third|fourth|fifth)\s*season/gi, '')
      .replace(/\s*cour\s+\d+/gi, '')
      .replace(/\s*\(tv\)\s*$/i, '')
      .replace(/\s*\(.*?\)\s*$/g, '')
      .replace(/:$/, '')
      .trim()
      .toLowerCase();
    if (!grouped.has(normalized)) {
      grouped.set(normalized, item);
    } else {
      // Prefer entry with MAL ID (more canonical) or shorter name
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
    let items = deduplicateAnime((data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[]);
    items = groupByFranchise(items);
    return items;
  } catch {
    return [];
  }
}

export async function getPopularAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(LIST_QUERY, { page, genre: genre || null, q: null });
    let items = deduplicateAnime((data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[]);
    items = groupByFranchise(items);
    return items;
  } catch {
    return [];
  }
}

export async function getTrendingAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(TRENDING_QUERY, { page, genre: genre || null });
    let items = deduplicateAnime((data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[]);
    items = groupByFranchise(items);
    return items;
  } catch {
    return [];
  }
}

export async function getAiringAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  const { season, year } = getCurrentSeason();
  try {
    const data = await anilistQuery(AIRING_QUERY, { page, genre: genre || null, season, year });
    let items = deduplicateAnime((data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[]);
    items = groupByFranchise(items);
    return items;
  } catch {
    return [];
  }
}

const RELATIONS_QUERY = `query ($id: Int) {
  Media(id: $id) {
    relations {
      edges {
        node {
          id idMal
          title { romaji english native }
          type
          episodes
          season
          seasonYear
          format
        }
        relationType
      }
    }
  }
}`;

const INITIAL_EP_LIMIT = 100;

// Server-side in-memory cache for getAnimeDetails (TTL: 5 min)
const animeDetailCache = new Map<string, { data: any; expires: number }>();
function getCachedDetail(key: string) {
  const cached = animeDetailCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  return null;
}
function setCachedDetail(key: string, data: any) {
  animeDetailCache.set(key, { data, expires: Date.now() + 300000 });
}

// Get anime details + related seasons via AniList + Jikan fallback
export async function getAnimeDetails(id: string, epLimit = INITIAL_EP_LIMIT, skipEpisodes = false): Promise<{
  anime: AnimeItem;
  episodes: EpisodeDetail[];
  totalEpisodes: number;
  seasons: SeasonInfo[];
} | null> {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;

  const cacheKey = `${id}:${epLimit}:${skipEpisodes}`;
  const cached = getCachedDetail(cacheKey);
  if (cached) return cached;

  // Fetch main anime metadata
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
    // AniList failed, try Jikan fallback below
  }

  // If AniList returned nothing, try Jikan lookup
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
                episodeId: `${id}-${i}`,
                episodeNum: i,
                title: `Episode ${i}`,
                description: null,
                thumbnail: null,
                malUrl: null,
                releasedDate: null,
                isFiller: false,
                isRecap: false,
              });
            }
          }
          episodes.sort((a, b) => a.episodeNum - b.episodeNum);
          const jikanResult = {
            anime: {
              id: String(a.mal_id),
              idMal: String(a.mal_id),
              name: a.title_english || a.title || "Unknown",
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
            },
            episodes,
            totalEpisodes: totalEps,
            seasons: [],
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

  // Fetch relations separately (don't fail main query if relations time out)
  const VALID_RELATION_TYPES = new Set(["SEQUEL", "PREQUEL", "SIDE_STORY"]);
  let relatedSeasons: { id: number; idMal: number | null; title: string; episodes: number; season: string; seasonYear: number; format: string | null }[] = [];
  try {
    const relData = await anilistQuery(RELATIONS_QUERY, { id: numId });
    const edges = relData?.data?.Media?.relations?.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      const relType: string = edge.relationType || "";
      if (node.type === "ANIME" && VALID_RELATION_TYPES.has(relType)) {
        // Skip entries with 0 episodes unless they're movies or specials
        if ((node.episodes === null || node.episodes === 0) && node.format !== "MOVIE" && node.format !== "SPECIAL" && node.format !== "OVA" && node.format !== "ONA") {
          continue;
        }
        relatedSeasons.push({
          id: node.id,
          idMal: node.idMal || null,
          title: node.title?.english || node.title?.romaji || "",
          episodes: node.episodes || 0,
          season: node.season || "FALL",
          seasonYear: node.seasonYear || 0,
          format: node.format || null,
        });
      }
    }
  } catch {
    // Relations failed, proceed without seasons
  }

  const isMovieFormat = media.format === "MOVIE" || media.format === "SPECIAL" || media.format === "OVA" || media.format === "ONA";

  // Build season list
  const seen = new Set<number>();
  const currentEntry = {
    id: numId,
    idMal: media.idMal || null,
    title: anime.name,
    episodes: media.episodes,
    season: media.season || "FALL",
    seasonYear: media.seasonYear || 0,
    format: media.format,
  };

  const allSeasons = [currentEntry, ...relatedSeasons].filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  const seasonOrder = ["WINTER", "SPRING", "SUMMER", "FALL"];
  allSeasons.sort((a, b) => {
    if (a.seasonYear !== b.seasonYear) return a.seasonYear - b.seasonYear;
    return seasonOrder.indexOf(a.season) - seasonOrder.indexOf(b.season);
  });

  let tvCount = 0;
  let movieCount = 0;
  let ovaCount = 0;
  let specialCount = 0;
  const seasons: SeasonInfo[] = allSeasons.map((s, i) => {
    const isMovie = s.format === "MOVIE";
    const isOva = s.format === "OVA" || s.format === "ONA";
    const isSpecial = s.format === "SPECIAL";
    const isTv = !isMovie && !isOva && !isSpecial;

    let label: string;
    if (isMovie) { movieCount++; label = `Movie ${movieCount}`; }
    else if (isOva) { ovaCount++; label = `OVA ${ovaCount}`; }
    else if (isSpecial) { specialCount++; label = `Special ${specialCount}`; }
    else { tvCount++; label = `Season ${tvCount}`; }

    const totalEp = isMovie || isOva || isSpecial
      ? Math.max(s.episodes || 1, 1)
      : Math.max(s.episodes || 12, 1);
    return {
      id: String(s.id),
      name: s.title,
      seasonLabel: label,
      totalEpisodes: totalEp,
      isCurrent: s.id === numId,
      idMal: s.idMal,
    };
  });

  const totalEpisodes = allSeasons.reduce((sum, s) => sum + Math.max(s.episodes || 1, 1), 0);

  // Skip full episode fetching when only metadata is needed (faster initial load)
  if (skipEpisodes) {
    const basicEpisodes: EpisodeDetail[] = [];
    allSeasons.forEach((s, idx) => {
      const seasonId = String(s.id);
      const isMovie = s.format === "MOVIE" || s.format === "SPECIAL" || s.format === "OVA" || s.format === "ONA";
      const count = isMovie ? 1 : Math.min(Math.max(s.episodes || 1, 1), epLimit);
      for (let i = 1; i <= count; i++) {
        basicEpisodes.push({
          episodeId: `${seasonId}-${i}`,
          episodeNum: i,
          title: i === 1 && isMovie ? s.title : `Episode ${i}`,
          description: null,
          thumbnail: null,
          malUrl: null,
          releasedDate: null,
          isFiller: false,
          isRecap: false,
          seasonNum: idx + 1,
          seasonId,
          seasonName: s.title,
          seasonMalId: s.idMal || null,
        });
      }
    });
    const skipResult = { anime, episodes: basicEpisodes, totalEpisodes, seasons };
    setCachedDetail(cacheKey, skipResult);
    return skipResult;
  }

  // Fetch episodes for ALL seasons sequentially (avoid Jikan rate limits) and combine
  const allCombinedEpisodes: EpisodeDetail[] = [];
  for (const [idx, s] of allSeasons.entries()) {
    if (idx > 0) await new Promise(r => setTimeout(r, 1000));

    const seasonId = String(s.id);
    let seasonMalId = s.idMal;

    // If AniList relation didn't include idMal, try fetching it separately
    if (seasonMalId === null) {
      try {
        const q = `query ($id: Int) { Media(id: $id, type: ANIME) { idMal } }`;
        const md = await anilistQuery(q, { id: s.id });
        seasonMalId = md?.data?.Media?.idMal || null;
        if (seasonMalId) await new Promise(r => setTimeout(r, 400));
      } catch { /* use null */ }
    }

    const isMovie = s.format === "MOVIE" || s.format === "SPECIAL" || s.format === "OVA" || s.format === "ONA";
    const maxEp = isMovie
      ? Math.max(s.episodes || 1, 1)
      : Math.max(s.episodes || 12, 1);

    const seasonCap = Math.min(maxEp, epLimit);
    let seasonEps: EpisodeDetail[] = [];
    if (seasonMalId) {
      const realEps = await fetchEpisodesFromJikan(seasonMalId, seasonId, seasonCap);
      if (realEps) seasonEps = realEps;
    }

    const existingNums = new Set(seasonEps.map(e => e.episodeNum));
    for (let i = 1; i <= seasonCap; i++) {
      if (!existingNums.has(i)) {
        seasonEps.push({
          episodeId: `${seasonId}-${i}`,
          episodeNum: i,
          title: `Episode ${i}`,
          description: null,
          thumbnail: null,
          malUrl: null,
          releasedDate: null,
          isFiller: false,
          isRecap: false,
        });
      }
    }

    seasonEps.sort((a, b) => a.episodeNum - b.episodeNum);
    seasonEps.forEach(ep => {
      ep.seasonNum = idx + 1;
      ep.seasonId = seasonId;
      ep.seasonName = s.title;
      ep.seasonMalId = seasonMalId;
    });

    allCombinedEpisodes.push(...seasonEps);
  }

  const realTotal = allCombinedEpisodes.length;

  const fullResult = { anime, episodes: allCombinedEpisodes, totalEpisodes: realTotal, seasons };
  setCachedDetail(cacheKey, fullResult);
  return fullResult;
}

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

    // Try Crunchyroll CDN thumbnail (episode-specific screenshot)
    const crMatch = html.match(/https?:\/\/img\d\.ak\.crunchyroll\.com\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/i);
    if (crMatch) return crMatch[0];

    // Try any large lazyload image in the video embed
    const lazyMatch = html.match(/data-src="([^"]+)"[^>]*width="800"/i);
    if (lazyMatch) return lazyMatch[1];

    // Try poster attribute on video element
    const posterMatch = html.match(/poster="([^"]+)"/i);
    if (posterMatch) return posterMatch[1];

    // Fall back to og:image (anime poster)
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

// Batch-scrape thumbnails for episodes (all episodes, non-blocking)
async function batchScrapeThumbnails(
  episodes: EpisodeDetail[]
): Promise<void> {
  const toScrape = episodes.filter(ep => ep.malUrl && !ep.thumbnail);
  if (toScrape.length === 0) return;

  await Promise.allSettled(
    toScrape.map((ep, i) =>
      new Promise(resolve => setTimeout(resolve, i * 100))
        .then(() => fetchEpisodeThumbnail(ep.malUrl!))
        .then(thumb => { if (thumb) ep.thumbnail = thumb; })
    )
  );
}

// In-memory cache for anime detail fetches (avoids duplicate Jikan crawls)
const detailCache = new Map<string, { data: any; expires: number }>();

// Main fetch function for the API routes
export async function fetchAnimeApi(
  endpoint: string,
  isDetail = false
): Promise<any> {
  const [path, queryString] = endpoint.split("?");
  const params = new URLSearchParams(queryString || "");
  const page = parseInt(params.get("page") || "1", 10);
  const genre = params.get("genre") || undefined;

  const isSearch = path.includes("/search") || path.includes("keyword=");
  const isPopular = path.includes("/popular");
  const isAiring = path.includes("/airing") || path.includes("/latest") || path.includes("/recent");
  const isTrending = path.includes("/trending");
  const isSeries = path.startsWith("/series/");

  if (isDetail || isSeries) {
    const id = path.replace("/series/", "").split("?")[0];
    const cacheKey = `detail:${id}`;
    const cached = detailCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    const result = await getAnimeDetails(id);
    if (result) {
      const response = {
        success: true,
        data: {
          ...result.anime,
          episodes: result.episodes,
          totalEpisodes: result.totalEpisodes,
          seasons: result.seasons,
        },
      };
      detailCache.set(cacheKey, { data: response, expires: Date.now() + 300000 });
      return response;
    }
    throw new Error("Anime not found");
  }

  if (isSearch) {
    const keyword = params.get("keyword") || params.get("q") || "";
    let items = await searchAnime(keyword, page, genre);
    if (items.length === 0) {
      items = await searchViaJikan(keyword);
    }
    return { success: true, data: items.filter((item) => !isAdultContent(item.name, item.genres, item.description)) };
  }

  if (isAiring) {
    const items = await getAiringAnime(page, genre);
    return { success: true, data: items.filter((item) => !isAdultContent(item.name, item.genres, item.description)) };
  }

  if (isTrending) {
    const items = await getTrendingAnime(page, genre);
    return { success: true, data: items.filter((item) => !isAdultContent(item.name, item.genres, item.description)) };
  }

  // default: popular
  const items = await getPopularAnime(page, genre);
  return { success: true, data: items.filter((item) => !isAdultContent(item.name, item.genres, item.description)) };
}

