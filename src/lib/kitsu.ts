import { 
  DEFAULT_FETCH_USER_AGENT, 
  cleanAnimeDescription, 
  buildSeasonList, 
  parseSeasonNumberFromTitle, 
  fetchEpisodesFromAniZip,
  type AnimeItem,
  type EpisodeDetail,
  type SeasonInfo,
  type FranchiseNode
} from "./anime-fetch";
import { getCuratedAnimeFranchiseNodes } from "./franchises";
import { searchTmdbShow } from "./tmdb";

export const KITSU_BASE = "https://kitsu.io/api/edge";

export async function kitsuFetchJson<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_FETCH_USER_AGENT,
        "Accept": "application/vnd.api+json",
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 } as any,
    });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export function normalizeKitsuGenre(genre: string): string {
  return genre.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
}

export function transformKitsu(kitsuItem: any, categoriesMap?: Map<string, string>): AnimeItem {
  const attr = kitsuItem?.attributes || {};
  const catIds = kitsuItem?.relationships?.categories?.data?.map((c: any) => c.id) || [];
  let genres: string[] = [];
  if (categoriesMap && catIds.length > 0) {
    genres = catIds.map((id: string) => categoriesMap.get(id)).filter(Boolean) as string[];
  }

  let status: string | null = null;
  if (attr.status === "current") {
    status = "RELEASING";
  } else if (attr.status === "upcoming" || attr.status === "unreleased") {
    status = "NOT_YET_RELEASED";
  } else if (attr.status === "finished") {
    status = "FINISHED";
  }

  let season: string | null = null;
  let seasonYear: number | null = null;
  if (attr.startDate) {
    try {
      const d = new Date(attr.startDate);
      if (!isNaN(d.getTime())) {
        seasonYear = d.getFullYear();
        const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
        season = seasons[Math.floor(d.getMonth() / 3)] || null;
      }
    } catch {}
  }

  const subtype = (attr.subtype || "TV").toUpperCase();
  const titleEnglish = attr.titles?.en || null;
  const titleRomaji = attr.canonicalTitle || attr.titles?.en_jp || "Anime";
  const name = titleEnglish || titleRomaji;
  const jname = attr.titles?.ja_jp || null;

  const poster = attr.posterImage?.large || attr.posterImage?.original || attr.posterImage?.medium || attr.posterImage?.small || "";
  const bannerImage = attr.coverImage?.large || attr.coverImage?.original || attr.coverImage?.small || null;

  let rating: string | null = null;
  if (attr.averageRating) {
    const r = parseFloat(attr.averageRating);
    if (!isNaN(r)) rating = (r / 10).toFixed(1);
  }

  return {
    id: "kitsu-" + String(kitsuItem.id),
    name,
    jname,
    poster,
    bannerImage,
    type: subtype,
    episodes: { sub: attr.episodeCount || null, dub: null },
    rating,
    description: cleanAnimeDescription(attr.synopsis || attr.description),
    genres: genres.length > 0 ? genres : [],
    status,
    season,
    seasonYear,
    format: subtype,
    duration: attr.episodeLength || null,
    trailerId: attr.youtubeVideoId || null,
  };
}

export async function searchViaKitsu(q: string, page = 1, genre?: string): Promise<AnimeItem[]> {
  const cleanQ = q.trim();
  if (!cleanQ) return [];
  try {
    const offset = Math.max((page - 1) * 20, 0);
    let url = `${KITSU_BASE}/anime?filter[text]=${encodeURIComponent(cleanQ)}&page[limit]=20&page[offset]=${offset}&include=categories`;
    if (genre) {
      url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
    }
    const res = await kitsuFetchJson<any>(url);
    if (!res || !Array.isArray(res.data) || res.data.length === 0) return [];

    const categoriesMap = new Map<string, string>();
    for (const inc of res.included || []) {
      if (inc.type === "categories" && inc.attributes?.title) {
        categoriesMap.set(inc.id, inc.attributes.title);
      }
    }

    return res.data.map((item: any) => transformKitsu(item, categoriesMap));
  } catch {
    return [];
  }
}

export async function getPopularAnimeViaKitsu(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const offset = Math.max((page - 1) * 20, 0);
    let url = `${KITSU_BASE}/anime?sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;
    if (genre) {
      url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
    }
    const res = await kitsuFetchJson<any>(url);
    if (!res || !Array.isArray(res.data) || res.data.length === 0) return [];

    const categoriesMap = new Map<string, string>();
    for (const inc of res.included || []) {
      if (inc.type === "categories" && inc.attributes?.title) {
        categoriesMap.set(inc.id, inc.attributes.title);
      }
    }

    return res.data.map((item: any) => transformKitsu(item, categoriesMap));
  } catch {
    return [];
  }
}

export async function getTrendingAnimeViaKitsu(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const offset = Math.max((page - 1) * 20, 0);
    let url = `${KITSU_BASE}/anime?filter[status]=current&sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;
    if (genre) {
      url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
    }
    let res = await kitsuFetchJson<any>(url);
    if (!res || !Array.isArray(res.data) || res.data.length === 0) {
      res = await kitsuFetchJson<any>(`${KITSU_BASE}/trending/anime?limit=20`);
    }
    if (!res || !Array.isArray(res.data) || res.data.length === 0) return [];

    const categoriesMap = new Map<string, string>();
    for (const inc of res.included || []) {
      if (inc.type === "categories" && inc.attributes?.title) {
        categoriesMap.set(inc.id, inc.attributes.title);
      }
    }

    return res.data.map((item: any) => transformKitsu(item, categoriesMap));
  } catch {
    return [];
  }
}

export async function getAiringAnimeViaKitsu(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const offset = Math.max((page - 1) * 20, 0);
    let url = `${KITSU_BASE}/anime?filter[status]=current&sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;
    if (genre) {
      url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
    }
    const res = await kitsuFetchJson<any>(url);
    if (!res || !Array.isArray(res.data) || res.data.length === 0) return [];

    const categoriesMap = new Map<string, string>();
    for (const inc of res.included || []) {
      if (inc.type === "categories" && inc.attributes?.title) {
        categoriesMap.set(inc.id, inc.attributes.title);
      }
    }

    return res.data.map((item: any) => transformKitsu(item, categoriesMap));
  } catch {
    return [];
  }
}

export async function getUpcomingAnimeViaKitsu(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const offset = Math.max((page - 1) * 20, 0);
    let url = `${KITSU_BASE}/anime?filter[status]=upcoming&sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;
    if (genre) {
      url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
    }
    const res = await kitsuFetchJson<any>(url);
    if (!res || !Array.isArray(res.data) || res.data.length === 0) return [];

    const categoriesMap = new Map<string, string>();
    for (const inc of res.included || []) {
      if (inc.type === "categories" && inc.attributes?.title) {
        categoriesMap.set(inc.id, inc.attributes.title);
      }
    }

    return res.data.map((item: any) => transformKitsu(item, categoriesMap));
  } catch {
    return [];
  }
}

export async function fetchEpisodesFromKitsu(
  animeName: string,
  seasonCap: number
): Promise<EpisodeDetail[] | null> {
  try {
    const searchRes = await fetch(
      `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(animeName)}&page[limit]=1`,
      { signal: AbortSignal.timeout(8000), headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT }, next: { revalidate: 86400 } as any }
    );
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const anime = searchJson.data?.[0];
    if (!anime) return null;

    const kitsuId = anime.id;
    const limitParam = Math.min(Math.max(seasonCap || 20, 1), 20);
    const epRes = await fetch(
      `https://kitsu.io/api/edge/anime/${kitsuId}/episodes?page[limit]=${limitParam}`,
      { signal: AbortSignal.timeout(8000), headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT }, next: { revalidate: 86400 } as any }
    );
    if (!epRes.ok) return null;
    const epJson = await epRes.json();
    const epsData = epJson.data || [];

    const eps: EpisodeDetail[] = [];
    const effectiveCap = seasonCap && seasonCap > 0 ? Math.max(seasonCap, 1500) : 1500;
    for (const ep of epsData) {
      const epNum = ep.attributes?.number;
      if (!epNum || epNum > effectiveCap) continue;

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

export async function getAnimeDetailsViaKitsu(
  id: string,
  epLimit = 100,
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
  const isKitsuInput = id.startsWith("kitsu-");
  const isMalInput = id.startsWith("mal-");
  const rawCleanId = id.replace(/^(kitsu-|mal-|tmdb-)/, "");
  const numId = parseInt(rawCleanId, 10);

  let kitsuId: string | null = isKitsuInput ? rawCleanId : null;
  let aniZipMapping: any = null;
  let malId: string | null = isMalInput ? rawCleanId : null;
  let anilistId: string | null = (!isKitsuInput && !isMalInput && !isNaN(numId)) ? String(numId) : null;
  let tmdbId: number | null = null;

  // Step 1: Query AniZip mappings to resolve cross-platform IDs
  if (!kitsuId && !isNaN(numId)) {
    const aniZipQueryParam = isMalInput ? `mal_id=${numId}` : `anilist_id=${numId}`;
    try {
      const azRes = await fetch(`https://api.ani.zip/mappings?${aniZipQueryParam}`, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
        next: { revalidate: 86400 } as any,
      });
      if (azRes.ok) {
        aniZipMapping = await azRes.json();
        if (aniZipMapping?.mappings?.kitsu_id) kitsuId = String(aniZipMapping.mappings.kitsu_id);
        if (aniZipMapping?.mappings?.mal_id) malId = String(aniZipMapping.mappings.mal_id);
        if (aniZipMapping?.mappings?.anilist_id) anilistId = String(aniZipMapping.mappings.anilist_id);
        if (aniZipMapping?.mappings?.themoviedb_id) {
          const t = parseInt(aniZipMapping.mappings.themoviedb_id, 10);
          if (!isNaN(t)) tmdbId = t;
        }
      }
    } catch {}
  }

  // Step 2: Query Kitsu mappings if AniZip did not provide a kitsu_id
  if (!kitsuId && !isNaN(numId)) {
    const site = isMalInput ? "myanimelist/anime" : "anilist/anime";
    try {
      const kMapRes = await fetch(`${KITSU_BASE}/mappings?filter[external_site]=${site}&filter[external_id]=${numId}&include=item`, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT, "Accept": "application/vnd.api+json" },
        next: { revalidate: 86400 } as any,
      });
      if (kMapRes.ok) {
        const kMapData = await kMapRes.json();
        const mappedItem = kMapData.included?.[0] || kMapData.data?.[0]?.relationships?.item?.data;
        if (mappedItem?.id) kitsuId = String(mappedItem.id);
      }
    } catch {}
  }

  // Step 3: If still no kitsuId and id is a title string, search Kitsu by title
  if (!kitsuId) {
    try {
      const cleanTitle = id.replace(/[-_]/g, " ").trim();
      const sResults = await searchViaKitsu(cleanTitle, 1);
      if (sResults.length > 0 && sResults[0].id) {
        kitsuId = sResults[0].id.replace("kitsu-", "");
      }
    } catch {}
  }

  if (!kitsuId) return null;

  // Step 4: Fetch Kitsu anime data with categories and relationships
  const kitsuData = await kitsuFetchJson<any>(
    `${KITSU_BASE}/anime/${kitsuId}?include=categories,mediaRelationships.destination`
  );
  if (!kitsuData || !kitsuData.data) return null;

  const attr = kitsuData.data.attributes || {};
  const categoriesMap = new Map<string, string>();
  const relAnimeList: any[] = [];

  for (const inc of kitsuData.included || []) {
    if (inc.type === "categories" && inc.attributes?.title) {
      categoriesMap.set(inc.id, inc.attributes.title);
    }
    if (inc.type === "anime" && inc.attributes) {
      relAnimeList.push(inc);
    }
  }

  // Also query AniZip by kitsu_id if we didn't get it before
  if (!aniZipMapping) {
    try {
      const azRes = await fetch(`https://api.ani.zip/mappings?kitsu_id=${kitsuId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
        next: { revalidate: 86400 } as any,
      });
      if (azRes.ok) {
        aniZipMapping = await azRes.json();
        if (!anilistId && aniZipMapping?.mappings?.anilist_id) anilistId = String(aniZipMapping.mappings.anilist_id);
        if (!malId && aniZipMapping?.mappings?.mal_id) malId = String(aniZipMapping.mappings.mal_id);
        if (!tmdbId && aniZipMapping?.mappings?.themoviedb_id) {
          const t = parseInt(aniZipMapping.mappings.themoviedb_id, 10);
          if (!isNaN(t)) tmdbId = t;
        }
      }
    } catch {}
  }

  const effectiveId = anilistId || (malId ? `mal-${malId}` : (isKitsuInput ? id : `kitsu-${kitsuId}`));

  let status: string | null = null;
  if (attr.status === "current") {
    status = "RELEASING";
  } else if (attr.status === "upcoming" || attr.status === "unreleased") {
    status = "NOT_YET_RELEASED";
  } else if (attr.status === "finished") {
    status = "FINISHED";
  }

  const isUnreleased = status === "NOT_YET_RELEASED";

  let season: string | null = null;
  let seasonYear: number | null = null;
  if (attr.startDate) {
    try {
      const d = new Date(attr.startDate);
      if (!isNaN(d.getTime())) {
        seasonYear = d.getFullYear();
        const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
        season = seasons[Math.floor(d.getMonth() / 3)] || null;
      }
    } catch {}
  }

  const catIds = kitsuData.data.relationships?.categories?.data?.map((c: any) => c.id) || [];
  const genres = catIds.map((cid: string) => categoriesMap.get(cid)).filter(Boolean) as string[];

  const subtype = (attr.subtype || "TV").toUpperCase();
  const titleEnglish = attr.titles?.en || null;
  const titleRomaji = attr.canonicalTitle || attr.titles?.en_jp || "Anime";
  const name = titleEnglish || titleRomaji;
  const jname = attr.titles?.ja_jp || null;

  const poster = attr.posterImage?.large || attr.posterImage?.original || attr.posterImage?.medium || attr.posterImage?.small || "";
  const bannerImage = attr.coverImage?.large || attr.coverImage?.original || attr.coverImage?.small || null;

  let rating: string | null = null;
  if (attr.averageRating) {
    const r = parseFloat(attr.averageRating);
    if (!isNaN(r)) rating = (r / 10).toFixed(1);
  }

  const animeItem: AnimeItem = {
    id: effectiveId,
    idMal: malId ? String(malId) : null,
    name,
    jname,
    poster,
    bannerImage,
    type: subtype,
    episodes: { sub: attr.episodeCount || null, dub: null },
    rating,
    description: cleanAnimeDescription(attr.synopsis || attr.description),
    genres: genres.slice(0, 8),
    status,
    season,
    seasonYear,
    format: subtype,
    duration: attr.episodeLength || null,
    trailerId: attr.youtubeVideoId || null,
  };

  // Step 5: Derive TMDB show ID & season mapping
  if (!tmdbId) {
    try {
      tmdbId = await searchTmdbShow(animeItem.name, animeItem.seasonYear || undefined);
      if (!tmdbId && animeItem.jname) {
        tmdbId = await searchTmdbShow(animeItem.jname, animeItem.seasonYear || undefined);
      }
    } catch {}
  }

  let tmdbSeasonNumber: number | null = null;
  let episodeOffset = 0;
  if (tmdbId) {
    const azEp1 = aniZipMapping?.episodes?.["1"];
    if (azEp1 && azEp1.seasonNumber !== undefined && azEp1.episodeNumber !== undefined) {
      tmdbSeasonNumber = azEp1.seasonNumber;
      episodeOffset = Math.max(azEp1.episodeNumber - 1, 0);
    } else {
      tmdbSeasonNumber = parseSeasonNumberFromTitle(animeItem.name);
      episodeOffset = 0;
    }
  }

  // Prefer curated franchise nodes if this is a known curated series
  const numCheckId = anilistId ? parseInt(anilistId, 10) : numId;
  const curatedNodes = !isNaN(numCheckId) ? getCuratedAnimeFranchiseNodes(numCheckId) : null;
  let franchiseNodes: FranchiseNode[] = [];
  let seasonsList: SeasonInfo[] = [];

  if (curatedNodes && curatedNodes.length > 1) {
    franchiseNodes = curatedNodes as FranchiseNode[];
    seasonsList = buildSeasonList(franchiseNodes, numCheckId);
  } else {
    // Build franchise nodes from Kitsu relations
    const rawNodes: FranchiseNode[] = [
      {
        id: anilistId ? parseInt(anilistId, 10) : parseInt(kitsuId, 10),
        idMal: malId ? parseInt(malId, 10) : null,
        title: animeItem.name,
        episodes: attr.episodeCount || null,
        season,
        seasonYear,
        status,
        format: subtype,
        duration: attr.episodeLength || null,
        coverImage: poster || null,
        bannerImage: bannerImage || null,
      },
    ];

    for (const rel of relAnimeList) {
      const rAttr = rel.attributes || {};
      const rSubtype = (rAttr.subtype || "TV").toUpperCase();
      let rYear: number | null = null;
      let rSeason: string | null = null;
      if (rAttr.startDate) {
        try {
          const d = new Date(rAttr.startDate);
          if (!isNaN(d.getTime())) {
            rYear = d.getFullYear();
            const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
            rSeason = seasons[Math.floor(d.getMonth() / 3)] || null;
          }
        } catch {}
      }

      rawNodes.push({
        id: parseInt(rel.id, 10),
        idMal: null,
        title: rAttr.titles?.en || rAttr.canonicalTitle || rAttr.titles?.en_jp || "Related",
        episodes: rAttr.episodeCount || null,
        season: rSeason,
        seasonYear: rYear,
        status: rAttr.status === "current" ? "RELEASING" : (rAttr.status === "upcoming" ? "NOT_YET_RELEASED" : "FINISHED"),
        format: rSubtype,
        duration: rAttr.episodeLength || null,
        coverImage: rAttr.posterImage?.large || rAttr.posterImage?.original || null,
        bannerImage: rAttr.coverImage?.large || rAttr.coverImage?.original || null,
      });
    }

    franchiseNodes = rawNodes;
    if (franchiseNodes.length > 1) {
      seasonsList = buildSeasonList(franchiseNodes, anilistId ? parseInt(anilistId, 10) : parseInt(kitsuId, 10));
    } else {
      const isMovie = subtype === "MOVIE";
      const isSpecialFormat = ["MOVIE", "OVA", "SPECIAL"].includes(subtype);
      const singleSeason: SeasonInfo = {
        id: effectiveId,
        name: animeItem.name,
        seasonLabel: isMovie ? "Movie 1" : (isSpecialFormat ? `${subtype} 1` : "Season 1"),
        totalEpisodes: isMovie ? 1 : (isSpecialFormat ? Math.max(attr.episodeCount || 1, 1) : Math.max(attr.episodeCount || 12, 1)),
        isCurrent: true,
        idMal: malId ? parseInt(malId, 10) : null,
        seasonYear,
        status,
        tmdbId,
        tmdbSeasonNumber,
        episodeOffset,
        coverImage: poster || null,
        bannerImage: bannerImage || null,
      };
      seasonsList = [singleSeason];
    }
  }

  // Find active season
  const activeSeason = seasonsList.find(s => s.isCurrent) || seasonsList[0];
  const isMovieFormat = subtype === "MOVIE" || activeSeason?.seasonLabel?.startsWith("Movie");
  const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => activeSeason?.seasonLabel?.startsWith(t)) || isMovieFormat;
  const totalEps = isMovieFormat ? 1 : (isSpecialFormat ? Math.max(activeSeason?.totalEpisodes || 1, 1) : Math.max(activeSeason?.totalEpisodes || attr.episodeCount || 12, 1));

  // Step 6: Generate or fetch episodes
  const episodes: EpisodeDetail[] = [];

  if (skipEpisodes) {
    for (let i = 1; i <= Math.min(totalEps, epLimit); i++) {
      episodes.push({
        episodeId: `${effectiveId}-${i}`,
        episodeNum: i,
        title: isSpecialFormat && i === 1 ? animeItem.name : `Episode ${i}`,
        description: null,
        thumbnail: null,
        malUrl: null,
        releasedDate: null,
        isFiller: false,
        isRecap: false,
        seasonNum: 1,
        seasonId: effectiveId,
        seasonName: animeItem.name,
        seasonMalId: malId ? parseInt(malId, 10) : null,
      });
    }
  } else if (isUnreleased) {
    const targetCount = isSpecialFormat ? 1 : Math.min(totalEps, epLimit);
    for (let i = 1; i <= targetCount; i++) {
      episodes.push({
        episodeId: `${effectiveId}-${i}`,
        episodeNum: i,
        title: isSpecialFormat && i === 1 ? animeItem.name : `Episode ${i}`,
        description: null,
        thumbnail: null,
        malUrl: null,
        releasedDate: null,
        isFiller: false,
        isRecap: false,
        isReleased: false,
        seasonNum: 1,
        seasonId: effectiveId,
        seasonName: animeItem.name,
        seasonMalId: malId ? parseInt(malId, 10) : null,
      });
    }
  } else {
    // 1. AniZip episodes if available
    let resolvedEps: EpisodeDetail[] | null = null;
    if (anilistId) {
      try {
        resolvedEps = await fetchEpisodesFromAniZip(anilistId, totalEps);
      } catch {}
    }

    // 2. Kitsu episodes endpoint fallback
    if (!resolvedEps || resolvedEps.length === 0) {
      try {
        const kEpsRes = await kitsuFetchJson<any>(
          `${KITSU_BASE}/anime/${kitsuId}/episodes?page[limit]=${Math.min(totalEps, 100)}&page[offset]=0`
        );
        if (kEpsRes?.data && Array.isArray(kEpsRes.data) && kEpsRes.data.length > 0) {
          resolvedEps = kEpsRes.data.map((ep: any) => {
            const epNum = ep.attributes?.number || ep.attributes?.relativeNumber || 1;
            const epTitle = ep.attributes?.canonicalTitle || ep.attributes?.titles?.en_us || ep.attributes?.titles?.en_jp || `Episode ${epNum}`;
            const epThumb = ep.attributes?.thumbnail?.original || null;
            return {
              episodeId: `${effectiveId}-${epNum}`,
              episodeNum: epNum,
              title: epTitle,
              description: cleanAnimeDescription(ep.attributes?.synopsis || ep.attributes?.description),
              thumbnail: epThumb,
              releasedDate: ep.attributes?.airdate || null,
              isFiller: false,
              isRecap: false,
              malUrl: malId ? `https://myanimelist.net/anime/${malId}/episode/${epNum}` : null,
              runtime: ep.attributes?.length || null,
            };
          });
        }
      } catch {}
    }

    if (resolvedEps && resolvedEps.length > 0) {
      episodes.push(...resolvedEps);
    }

    // Fill missing numbers
    const existingNums = new Set(episodes.map(e => e.episodeNum));
    const maxCount = Math.min(totalEps, epLimit);
    for (let i = 1; i <= maxCount; i++) {
      if (!existingNums.has(i)) {
        episodes.push({
          episodeId: `${effectiveId}-${i}`,
          episodeNum: i,
          title: isSpecialFormat && i === 1 ? animeItem.name : `Episode ${i}`,
          description: null,
          thumbnail: null,
          malUrl: malId ? `https://myanimelist.net/anime/${malId}/episode/${i}` : null,
          releasedDate: null,
          isFiller: false,
          isRecap: false,
        });
      }
    }

    episodes.sort((a, b) => a.episodeNum - b.episodeNum);
    episodes.forEach(ep => {
      ep.seasonNum = 1;
      ep.seasonId = effectiveId;
      ep.seasonName = animeItem.name;
      ep.seasonMalId = malId ? parseInt(malId, 10) : null;
    });
  }

  const tmdbSeasonMap = tmdbId && tmdbSeasonNumber != null ? { [effectiveId]: tmdbSeasonNumber } : undefined;

  return {
    anime: animeItem,
    episodes,
    totalEpisodes: episodes.length > 0 ? episodes.length : totalEps,
    seasons: seasonsList,
    openedSeasonId: effectiveId,
    franchiseNodes,
    tmdbId,
    tmdbSeasonMap,
  };
}

export async function fetchKitsuClientAnime(
  category: string,
  page = 1,
  genre = "",
  q = ""
): Promise<{ items: AnimeItem[]; hasMore: boolean }> {
  try {
    const offset = Math.max((page - 1) * 20, 0);
    let url = `${KITSU_BASE}/anime?sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;

    if (category === "search" || q) {
      const cleanQ = (q || "").trim();
      url = `${KITSU_BASE}/anime?filter[text]=${encodeURIComponent(cleanQ)}&page[limit]=20&page[offset]=${offset}&include=categories`;
      if (genre) {
        url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
      }
    } else if (category === "airing") {
      url = `${KITSU_BASE}/anime?filter[status]=current&sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;
      if (genre) {
        url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
      }
    } else if (category === "trending") {
      url = `${KITSU_BASE}/anime?filter[status]=current&sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;
      if (genre) {
        url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
      }
    } else if (category === "upcoming") {
      url = `${KITSU_BASE}/anime?filter[status]=upcoming&sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;
      if (genre) {
        url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
      }
    } else if (genre) {
      url = `${KITSU_BASE}/anime?filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}&sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;
    }

    const res = await fetch(url, { headers: { Accept: "application/vnd.api+json" } });
    if (!res.ok) return { items: [], hasMore: false };
    const data = await res.json();
    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      return { items: [], hasMore: false };
    }

    const categoriesMap = new Map<string, string>();
    for (const inc of data.included || []) {
      if (inc.type === "categories" && inc.attributes?.title) {
        categoriesMap.set(inc.id, inc.attributes.title);
      }
    }

    const seen = new Set<string>();
    const items = data.data
      .map((item: any) => transformKitsu(item, categoriesMap))
      .filter((item: AnimeItem) => {
        if (!item || !item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        const s = (item as any).status;
        if (s === "CANCELLED" || s === "Cancelled") return false;
        return true;
      });

    return { items, hasMore: items.length > 0 };
  } catch (e) {
    console.warn("[Kitsu Client Fallback Error]:", e);
    return { items: [], hasMore: false };
  }
}
