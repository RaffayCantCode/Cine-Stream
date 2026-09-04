import { 
  DEFAULT_FETCH_USER_AGENT, 
  cleanAnimeDescription, 
  buildSeasonList, 
  parseSeasonNumberFromTitle, 
  fetchEpisodesFromAniZip,
  cacheFranchiseNodes,
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

export async function enrichKitsuWithAniListIds(items: any[], categoriesMap?: Map<string, string>): Promise<AnimeItem[]> {
  if (!items || items.length === 0) return [];
  
  const baseItems = items.map((item: any) => transformKitsu(item, categoriesMap));

  await Promise.all(baseItems.map(async (anime) => {
    try {
      const cleanKId = anime.id.replace(/^kitsu-/, "");
      // Use 4s timeout — 2s was too short on Cloudflare edge cold starts
      const azRes = await fetch(`https://api.ani.zip/mappings?kitsu_id=${cleanKId}`, {
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
        next: { revalidate: 86400 } as any,
      });
      if (azRes.ok) {
        const az = await azRes.json();
        if (az?.mappings?.anilist_id) {
          anime.id = String(az.mappings.anilist_id);
          if (az.mappings.mal_id) anime.idMal = String(az.mappings.mal_id);
          return; // Fully resolved — done
        } else if (az?.mappings?.mal_id) {
          anime.idMal = String(az.mappings.mal_id);
          anime.id = `mal-${az.mappings.mal_id}`;
          return; // Got MAL at least
        }
      }

      // AniZip didn't have this Kitsu ID — try Kitsu's own mappings API to get MAL ID
      // This is a second-chance lookup so the item at least gets a MAL ID for streaming
      if (anime.id.startsWith("kitsu-")) {
        try {
          const kMapRes = await fetch(
            `https://kitsu.io/api/edge/mappings?filter[externalSite]=myanimelist/anime&filter[item.id]=${cleanKId}&include=item`,
            {
              signal: AbortSignal.timeout(3000),
              headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT, "Accept": "application/vnd.api+json" },
            }
          );
          if (kMapRes.ok) {
            const kMapData = await kMapRes.json();
            const malId = kMapData?.data?.[0]?.attributes?.externalId;
            if (malId) {
              anime.idMal = String(malId);
              anime.id = `mal-${malId}`;
            }
          }
        } catch { /* keep kitsu- id if fallback also fails */ }
      }
    } catch {}
  }));

  return baseItems;
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

    return await enrichKitsuWithAniListIds(res.data, categoriesMap);
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

    return await enrichKitsuWithAniListIds(res.data, categoriesMap);
  } catch {
    return [];
  }
}

export async function getTrendingAnimeViaKitsu(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    let url = `${KITSU_BASE}/trending/anime?limit=20`;
    if (genre || page > 1) {
      const offset = Math.max((page - 1) * 20, 0);
      url = `${KITSU_BASE}/anime?sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;
      if (genre) {
        url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
      }
    }
    let res = await kitsuFetchJson<any>(url);
    if (!res || !Array.isArray(res.data) || res.data.length === 0) {
      res = await kitsuFetchJson<any>(`${KITSU_BASE}/anime?sort=-userCount&page[limit]=20&include=categories`);
    }
    if (!res || !Array.isArray(res.data) || res.data.length === 0) return [];

    const categoriesMap = new Map<string, string>();
    for (const inc of res.included || []) {
      if (inc.type === "categories" && inc.attributes?.title) {
        categoriesMap.set(inc.id, inc.attributes.title);
      }
    }

    return await enrichKitsuWithAniListIds(res.data, categoriesMap);
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

    return await enrichKitsuWithAniListIds(res.data, categoriesMap);
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

    return await enrichKitsuWithAniListIds(res.data, categoriesMap);
  } catch {
    return [];
  }
}

export async function fetchEpisodesFromKitsu(
  animeNameOrId: string,
  seasonCap: number
): Promise<EpisodeDetail[] | null> {
  try {
    let kitsuId: string | null = null;
    const cleanInput = String(animeNameOrId || "").trim();

    if (cleanInput.startsWith("kitsu-")) {
      kitsuId = cleanInput.replace("kitsu-", "");
    } else if (cleanInput.startsWith("mal-")) {
      const malNum = cleanInput.replace("mal-", "");
      try {
        const azRes = await fetch(`https://api.ani.zip/mappings?mal_id=${malNum}`, {
          signal: AbortSignal.timeout(3000),
          headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
          next: { revalidate: 86400 } as any,
        });
        if (azRes.ok) {
          const az = await azRes.json();
          if (az?.mappings?.kitsu_id) kitsuId = String(az.mappings.kitsu_id);
        }
      } catch {}
      if (!kitsuId) {
        try {
          const kMap = await fetch(`${KITSU_BASE}/mappings?filter[external_site]=myanimelist/anime&filter[external_id]=${malNum}&include=item`, {
            signal: AbortSignal.timeout(3000),
            headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT, "Accept": "application/vnd.api+json" },
            next: { revalidate: 86400 } as any,
          });
          if (kMap.ok) {
            const kJson = await kMap.json();
            const it = kJson.included?.[0] || kJson.data?.[0]?.relationships?.item?.data;
            if (it?.id) kitsuId = String(it.id);
          }
        } catch {}
      }
    } else if (!isNaN(Number(cleanInput))) {
      // It is a numeric AniList ID - resolve it to Kitsu ID via AniZip or Kitsu mappings
      try {
        const azRes = await fetch(`https://api.ani.zip/mappings?anilist_id=${cleanInput}`, {
          signal: AbortSignal.timeout(3000),
          headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
          next: { revalidate: 86400 } as any,
        });
        if (azRes.ok) {
          const az = await azRes.json();
          if (az?.mappings?.kitsu_id) kitsuId = String(az.mappings.kitsu_id);
        }
      } catch {}
      if (!kitsuId) {
        try {
          const kMap = await fetch(`${KITSU_BASE}/mappings?filter[external_site]=anilist/anime&filter[external_id]=${cleanInput}&include=item`, {
            signal: AbortSignal.timeout(3000),
            headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT, "Accept": "application/vnd.api+json" },
            next: { revalidate: 86400 } as any,
          });
          if (kMap.ok) {
            const kJson = await kMap.json();
            const it = kJson.included?.[0] || kJson.data?.[0]?.relationships?.item?.data;
            if (it?.id) kitsuId = String(it.id);
          }
        } catch {}
      }
    } else {
      const searchRes = await fetch(
        `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanInput)}&page[limit]=1`,
        { signal: AbortSignal.timeout(8000), headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT }, next: { revalidate: 86400 } as any }
      );
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        kitsuId = searchJson.data?.[0]?.id || null;
      }
    }

    if (!kitsuId) return null;

    const eps: EpisodeDetail[] = [];
    const isSingleEpCap = seasonCap === 1;
    const maxFetch = isSingleEpCap ? 1 : Math.min(seasonCap && seasonCap > 0 ? seasonCap : 50, 100);
    const pageSize = isSingleEpCap ? 1 : 20;
    let offset = 0;

    while (eps.length < maxFetch && offset < maxFetch) {
      const epRes = await fetch(
        `https://kitsu.io/api/edge/anime/${kitsuId}/episodes?page[limit]=${Math.min(pageSize, maxFetch - eps.length)}&page[offset]=${offset}`,
        { signal: AbortSignal.timeout(8000), headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT }, next: { revalidate: 86400 } as any }
      );
      if (!epRes.ok) break;
      const epJson = await epRes.json();
      const epsData = epJson.data || [];
      if (epsData.length === 0) break;

      for (const ep of epsData) {
        const epNum = ep.attributes?.number || ep.attributes?.relativeNumber;
        if (!epNum) continue;
        if (isSingleEpCap && epNum > 1) continue;

        const title = ep.attributes?.canonicalTitle || ep.attributes?.titles?.en_us || ep.attributes?.titles?.en_jp || ep.attributes?.title || `Episode ${epNum}`;
        const description = cleanAnimeDescription(ep.attributes?.synopsis || ep.attributes?.description);
        const thumbObj = ep.attributes?.thumbnail;
        const thumbnail = thumbObj?.original || thumbObj?.large || thumbObj?.medium || thumbObj?.small || null;

        eps.push({
          episodeId: `kitsu-${kitsuId}-${epNum}`,
          episodeNum: epNum,
          title,
          description,
          thumbnail,
          releasedDate: ep.attributes?.airdate || null,
          isFiller: false,
          isRecap: false,
          runtime: ep.attributes?.length || null,
        });

        if (isSingleEpCap) break;
      }

      offset += pageSize;
      if (epsData.length < pageSize || isSingleEpCap) break;
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

  // Step 1: Query AniZip mappings to resolve cross-platform IDs (AniList, MAL, TMDB)
  const queryParam = kitsuId ? `kitsu_id=${kitsuId}` : (isMalInput ? `mal_id=${numId}` : (!isNaN(numId) ? `anilist_id=${numId}` : null));
  if (queryParam) {
    try {
      const azRes = await fetch(`https://api.ani.zip/mappings?${queryParam}`, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
        next: { revalidate: 86400 } as any,
      });
      if (azRes.ok) {
        aniZipMapping = await azRes.json();
        if (aniZipMapping?.mappings?.kitsu_id && !kitsuId) kitsuId = String(aniZipMapping.mappings.kitsu_id);
        if (aniZipMapping?.mappings?.mal_id && !malId) malId = String(aniZipMapping.mappings.mal_id);
        if (aniZipMapping?.mappings?.anilist_id && !anilistId) anilistId = String(aniZipMapping.mappings.anilist_id);
        if (aniZipMapping?.mappings?.themoviedb_id && !tmdbId) {
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

  // Step 3: If still no kitsuId and id is a title string (NOT a numeric ID), search Kitsu by title
  if (!kitsuId && isNaN(numId) && !isKitsuInput && !isMalInput) {
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
  const isMovieFormat = subtype === "MOVIE";
  if (!tmdbId && !isMovieFormat) {
    try {
      tmdbId = await searchTmdbShow(animeItem.name, animeItem.seasonYear || undefined);
      if (!tmdbId && animeItem.jname) {
        tmdbId = await searchTmdbShow(animeItem.jname, animeItem.seasonYear || undefined);
      }
    } catch {}
  }

  let tmdbSeasonNumber: number | null = null;
  let episodeOffset = 0;
  if (tmdbId && !isMovieFormat) {
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
        episodes: isMovieFormat ? 1 : (attr.episodeCount || null),
        season,
        seasonYear,
        status,
        format: subtype,
        duration: attr.episodeLength || null,
        coverImage: poster || null,
        bannerImage: bannerImage || null,
      },
    ];

    const mappedRelNodes = await Promise.all(
      relAnimeList.map(async (rel) => {
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

        let relAnilistId: number | null = null;
        let relMalId: number | null = null;
        try {
          const az = await fetch(`https://api.ani.zip/mappings?kitsu_id=${rel.id}`, {
            signal: AbortSignal.timeout(2500),
            headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
            next: { revalidate: 86400 } as any,
          });
          if (az.ok) {
            const azData = await az.json();
            if (azData?.mappings?.anilist_id) {
              const parsed = parseInt(String(azData.mappings.anilist_id), 10);
              if (!isNaN(parsed)) relAnilistId = parsed;
            }
            if (azData?.mappings?.mal_id) {
              const parsed = parseInt(String(azData.mappings.mal_id), 10);
              if (!isNaN(parsed)) relMalId = parsed;
            }
          }
        } catch {}

        // Never assign a raw Kitsu numeric ID as an AniList ID! If no AniList mapping, prefix with "kitsu-"
        const finalId = relAnilistId || `kitsu-${rel.id}`;

        return {
          id: finalId as any,
          idMal: relMalId,
          title: rAttr.titles?.en || rAttr.canonicalTitle || rAttr.titles?.en_jp || "Related",
          episodes: rSubtype === "MOVIE" ? 1 : (rAttr.episodeCount || null),
          season: rSeason,
          seasonYear: rYear,
          status: rAttr.status === "current" ? "RELEASING" : (rAttr.status === "upcoming" ? "NOT_YET_RELEASED" : "FINISHED"),
          format: rSubtype,
          duration: rAttr.episodeLength || null,
          coverImage: rAttr.posterImage?.large || rAttr.posterImage?.original || null,
          bannerImage: rAttr.coverImage?.large || rAttr.coverImage?.original || null,
        } as FranchiseNode;
      })
    );

    for (const n of mappedRelNodes) {
      rawNodes.push(n);
    }

    rawNodes.sort((a, b) => {
      const yearA = a.seasonYear || 9999;
      const yearB = b.seasonYear || 9999;
      if (yearA !== yearB) return yearA - yearB;
      const formatOrder = { TV: 0, TV_SHORT: 1, ONA: 2, OVA: 3, SPECIAL: 4, MOVIE: 5 };
      const fA = (formatOrder as any)[a.format || "TV"] ?? 6;
      const fB = (formatOrder as any)[b.format || "TV"] ?? 6;
      if (fA !== fB) return fA - fB;
      return 0;
    });

    franchiseNodes = rawNodes;
    if (franchiseNodes.length > 1) {
      cacheFranchiseNodes(franchiseNodes);
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
        tmdbId: isMovie ? null : tmdbId,
        tmdbSeasonNumber: isMovie ? null : tmdbSeasonNumber,
        episodeOffset: isMovie ? 0 : episodeOffset,
        coverImage: poster || null,
        bannerImage: bannerImage || null,
      };
      seasonsList = [singleSeason];
    }
  }

  let knownAniZipTotal: number | null = null;
  if (aniZipMapping?.episodes) {
    const keys = Object.keys(aniZipMapping.episodes).map(Number).filter(n => !isNaN(n));
    if (keys.length > 0) knownAniZipTotal = Math.max(...keys);
  }

  // Find active season
  const activeSeason = seasonsList.find(s => s.isCurrent) || seasonsList[0];
  const isMovieActive = subtype === "MOVIE" || activeSeason?.seasonLabel?.startsWith("Movie");
  const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => activeSeason?.seasonLabel?.startsWith(t)) || isMovieActive;
  const rawTotal = (activeSeason?.totalEpisodes && activeSeason.totalEpisodes > 0)
    ? activeSeason.totalEpisodes
    : (knownAniZipTotal || attr.episodeCount || (status === "RELEASING" ? 1500 : 12));
  const totalEps = isMovieActive ? 1 : (isSpecialFormat ? Math.max(rawTotal, 1) : Math.max(rawTotal, 1));

  if (activeSeason) {
    activeSeason.totalEpisodes = totalEps;
  }

  // Step 6: Generate or fetch episodes
  const episodes: EpisodeDetail[] = [];

  if (skipEpisodes) {
    for (let i = 1; i <= (isMovieActive ? 1 : Math.min(totalEps, epLimit)); i++) {
      episodes.push({
        episodeId: `${effectiveId}-${i}`,
        episodeNum: i,
        title: (isMovieActive || isSpecialFormat) && i === 1 ? animeItem.name : `Episode ${i}`,
        description: isMovieActive ? animeItem.description || null : null,
        thumbnail: isMovieActive ? animeItem.poster || null : null,
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
    const targetCount = isMovieActive ? 1 : (isSpecialFormat ? 1 : Math.min(totalEps, epLimit));
    for (let i = 1; i <= targetCount; i++) {
      episodes.push({
        episodeId: `${effectiveId}-${i}`,
        episodeNum: i,
        title: (isMovieActive || isSpecialFormat) && i === 1 ? animeItem.name : `Episode ${i}`,
        description: isMovieActive ? animeItem.description || null : null,
        thumbnail: isMovieActive ? animeItem.poster || null : null,
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
            const epTitle = isMovieActive ? animeItem.name : (ep.attributes?.canonicalTitle || ep.attributes?.titles?.en_us || ep.attributes?.titles?.en_jp || `Episode ${epNum}`);
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
      if (isMovieActive) {
        const firstEp = resolvedEps[0];
        firstEp.title = animeItem.name || "Complete Movie";
        episodes.push(firstEp);
      } else {
        episodes.push(...resolvedEps);
      }
    }

    // Fill missing numbers
    const existingNums = new Set(episodes.map(e => e.episodeNum));
    const maxCount = isMovieActive ? 1 : Math.min(totalEps, epLimit);
    for (let i = 1; i <= maxCount; i++) {
      if (!existingNums.has(i)) {
        episodes.push({
          episodeId: `${effectiveId}-${i}`,
          episodeNum: i,
          title: (isMovieActive || isSpecialFormat) && i === 1 ? animeItem.name : `Episode ${i}`,
          description: isMovieActive ? animeItem.description || null : null,
          thumbnail: isMovieActive ? animeItem.poster || null : null,
          malUrl: malId ? `https://myanimelist.net/anime/${malId}/episode/${i}` : null,
          releasedDate: null,
          isFiller: false,
          isRecap: false,
        });
      }
    }

    if (isMovieActive && episodes.length > 1) {
      episodes.splice(1);
    }

    episodes.sort((a, b) => a.episodeNum - b.episodeNum);
    episodes.forEach(ep => {
      ep.seasonNum = 1;
      ep.seasonId = effectiveId;
      ep.seasonName = animeItem.name;
      ep.seasonMalId = malId ? parseInt(malId, 10) : null;
    });
  }

  const tmdbSeasonMap = tmdbId && tmdbSeasonNumber != null && !isMovieFormat ? { [effectiveId]: tmdbSeasonNumber } : undefined;

  return {
    anime: animeItem,
    episodes,
    totalEpisodes: isMovieFormat ? 1 : (episodes.length > 0 ? episodes.length : totalEps),
    seasons: seasonsList,
    openedSeasonId: effectiveId,
    franchiseNodes,
    tmdbId: isMovieFormat ? null : tmdbId,
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
      if (genre || page > 1) {
        url = `${KITSU_BASE}/anime?sort=-userCount&page[limit]=20&page[offset]=${offset}&include=categories`;
        if (genre) {
          url += `&filter[categories]=${encodeURIComponent(normalizeKitsuGenre(genre))}`;
        }
      } else {
        url = `${KITSU_BASE}/trending/anime?limit=20`;
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

    const transformed = await enrichKitsuWithAniListIds(data.data, categoriesMap);
    const seen = new Set<string>();
    const items = transformed.filter((item: AnimeItem) => {
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
