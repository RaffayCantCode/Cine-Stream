import { AnimeItem } from "@/components/AnimeCard";
import { cleanAnimeDescription } from "@/lib/anime-fetch";
import { fetchKitsuClientAnime } from "@/lib/kitsu";

const ANILIST_API = "https://graphql.anilist.co";

export interface AnimeBrowseFilters {
  year?: number | null;
  format?: string | null;
  status?: string | null;
  season?: string | null;
  sort?: string | null;
}

const BROWSE_QUERY = `query ($page: Int, $genre: String, $q: String, $startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt, $format: MediaFormat, $status: MediaStatus, $season: MediaSeason, $sort: [MediaSort]) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: ANIME, isAdult: false, sort: $sort, genre: $genre, search: $q, startDate_greater: $startDateGreater, startDate_lesser: $startDateLesser, format: $format, status: $status, season: $season) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;


const LIST_QUERY = `query ($page: Int, $genre: String, $q: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], genre: $genre, search: $q) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear
    }
  }
}`;

const SEARCH_QUERY = `query ($page: Int, $genre: String, $q: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, genre: $genre, search: $q) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear
    }
  }
}`;

const TRENDING_QUERY = `query ($page: Int, $genre: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [TRENDING_DESC, POPULARITY_DESC], genre: $genre) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

const AIRING_QUERY = `query ($page: Int, $genre: String, $season: MediaSeason, $year: Int) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], genre: $genre, season: $season, seasonYear: $year) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge } bannerImage
      episodes genres averageScore description status type format season seasonYear duration
    }
  }
}`;

function transformAniList(media: any): AnimeItem | null {
  if (media.isAdult) return null;
  return {
    id: String(media.id),
    idMal: media.idMal ? String(media.idMal) : null,
    name: media.title.english || media.title.romaji,
    jname: media.title.native || null,
    poster: media.coverImage?.extraLarge || media.coverImage?.large || "",
    bannerImage: media.bannerImage || null,
    type: media.type || "TV",
    episodes: { sub: media.episodes || null, dub: null },
    rating: media.averageScore ? String(media.averageScore / 10) : null,
    description: cleanAnimeDescription(media.description),
    genres: media.genres || [],
    status: media.status || null,
    season: media.season || null,
    seasonYear: media.seasonYear || null,
    format: media.format || null,
    duration: media.duration || null,
  } as AnimeItem;
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

function filterUnreleased(items: AnimeItem[]): AnimeItem[] {
  return items.filter(item => {
    const s = (item as any).status;
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

async function clientAnilistQuery(query: string, variables: Record<string, any>, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return await res.json();
      if (res.status === 429 && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    } catch (e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
    }
  }
  throw new Error("Client AniList query failed");
}

const clientAnimeCache = new Map<string, { data: { items: AnimeItem[]; hasMore: boolean }; expires: number }>();
const CLIENT_ANIME_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CLIENT_CACHE_VERSION = "v33-anime-filters-fix";

export function invalidateClientAnimeCache(): void {
  clientAnimeCache.clear();
  if (typeof window !== "undefined") {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith("sv_client_") || k.startsWith("anime_") || k.startsWith("sv_anime_browse_page"))) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {}
  }
}

// Returns true if ALL items in the list are from primary sources (AniList),
// not raw Kitsu.
function isCacheFromPrimarySources(items: AnimeItem[]): boolean {
  if (!items || items.length === 0) return false;
  return items.every(item => {
    const id = String(item.id || "");
    return !id.startsWith("kitsu-");
  });
}

export async function fetchClientAnime(
  category: string,
  page = 1,
  genre = "",
  q = "",
  filters?: AnimeBrowseFilters
): Promise<{ items: AnimeItem[]; hasMore: boolean }> {
  const fYear = filters?.year ? Number(filters.year) : null;
  const fFormat = filters?.format || null;
  const fStatus = filters?.status || null;
  const fSeason = filters?.season || null;
  const fSort = filters?.sort || null;
  const hasAdvancedFilters = Boolean(fYear || fFormat || fStatus || fSeason || fSort);

  const filterKey = hasAdvancedFilters
    ? `_y${fYear || ""}_f${fFormat || ""}_st${fStatus || ""}_se${fSeason || ""}_so${fSort || ""}`
    : "";
  const cacheKey = `anime_${category}_${page}_${genre}_${q}${filterKey}`;
  const versionedKey = `sv_client_${CLIENT_CACHE_VERSION}_${cacheKey}`;

  // 1) In-memory cache check (only if items exist from primary sources!)
  const cachedMemory = clientAnimeCache.get(cacheKey);
  if (cachedMemory && cachedMemory.expires > Date.now() && cachedMemory.data.items?.length > 0 && isCacheFromPrimarySources(cachedMemory.data.items)) {
    return cachedMemory.data;
  }

  // 2) sessionStorage check (only if items exist from primary sources!)
  if (typeof window !== "undefined") {
    try {
      // Clear any old-format (non-versioned) cached entries to purge stale Kitsu data
      const oldKey = `sv_client_${cacheKey}`;
      if (sessionStorage.getItem(oldKey)) sessionStorage.removeItem(oldKey);

      const stored = sessionStorage.getItem(versionedKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.expires > Date.now() && parsed.data?.items?.length > 0 && isCacheFromPrimarySources(parsed.data.items)) {
          clientAnimeCache.set(cacheKey, parsed);
          return parsed.data;
        }
      }
    } catch {}
  }

  // 3) Direct browser query first (AniList client-side from user's residential IP)
  if (typeof window !== "undefined") {
    try {
      let items: AnimeItem[] = [];
      let hasNextPage = true;

      if (hasAdvancedFilters || category === "top_rated" || category === "newest" || category === "upcoming") {
        let sortArr: string[] = ["POPULARITY_DESC"];
        let resolvedStatus = fStatus;

        if (q) {
          sortArr = ["SEARCH_MATCH", "POPULARITY_DESC"];
        } else if (fSort === "TRENDING_DESC" || category === "trending") {
          sortArr = ["TRENDING_DESC", "POPULARITY_DESC"];
        } else if (fSort === "SCORE_DESC" || category === "top_rated") {
          sortArr = ["SCORE_DESC", "POPULARITY_DESC"];
        } else if (fSort === "START_DATE_DESC" || category === "newest") {
          sortArr = ["START_DATE_DESC", "POPULARITY_DESC"];
        } else if (fSort === "FAVOURITES_DESC") {
          sortArr = ["FAVOURITES_DESC", "POPULARITY_DESC"];
        }

        if (category === "airing" && !resolvedStatus) {
          resolvedStatus = "RELEASING";
        } else if (category === "upcoming" && !resolvedStatus) {
          resolvedStatus = "NOT_YET_RELEASED";
        }

        // AniList GraphQL treats explicit `null` enum/int variables as matching NULL values (returning 0 results).
        // Only include variables that are actually set!
        const vars: Record<string, any> = {
          page,
          sort: sortArr,
        };
        if (genre) vars.genre = genre;
        if (q) vars.q = q;
        if (fFormat) vars.format = fFormat;
        if (resolvedStatus) vars.status = resolvedStatus;
        if (fSeason) vars.season = fSeason;

        if (fYear && Number.isFinite(fYear)) {
          // FuzzyDateInt range covers TV, Movies, OVAs, ONAs, and Specials from that year
          vars.startDateGreater = fYear * 10000;
          vars.startDateLesser = fYear * 10000 + 9999;
        } else if ((fSort === "START_DATE_DESC" || category === "newest") && resolvedStatus !== "NOT_YET_RELEASED") {
          // Cap "Newest" to already-released anime instead of future unannounced years
          const now = new Date();
          vars.startDateLesser =
            now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        }

        const data = await clientAnilistQuery(BROWSE_QUERY, vars);
        items = (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
        hasNextPage = Boolean(data?.data?.Page?.pageInfo?.hasNextPage ?? items.length >= 20);
      } else if (category === "search" || q) {
        const vars: Record<string, any> = { page, q };
        if (genre) vars.genre = genre;
        const data = await clientAnilistQuery(SEARCH_QUERY, vars);
        items = (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
        hasNextPage = items.length >= 20;
      } else if (category === "airing") {
        const { season, year } = getCurrentSeason();
        const vars: Record<string, any> = { page, season, year };
        if (genre) vars.genre = genre;
        const data = await clientAnilistQuery(AIRING_QUERY, vars);
        items = (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
        hasNextPage = items.length >= 20;
      } else if (category === "trending") {
        const vars: Record<string, any> = { page };
        if (genre) vars.genre = genre;
        const data = await clientAnilistQuery(TRENDING_QUERY, vars);
        items = (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
        hasNextPage = items.length >= 20;
      } else {
        const vars: Record<string, any> = { page };
        if (genre) vars.genre = genre;
        const data = await clientAnilistQuery(LIST_QUERY, vars);
        items = (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
        hasNextPage = items.length >= 20;
      }

      items = filterUnreleased(deduplicateAnime(items));
      if (items.length > 0 || hasAdvancedFilters) {
        const result = { items, hasMore: hasNextPage && items.length > 0 };
        if (items.length > 0) {
          clientAnimeCache.set(cacheKey, { data: result, expires: Date.now() + CLIENT_ANIME_CACHE_TTL });
          try {
            sessionStorage.setItem(versionedKey, JSON.stringify({ data: result, expires: Date.now() + CLIENT_ANIME_CACHE_TTL }));
          } catch {}
        }
        return result;
      }
    } catch (e) {
      console.warn("Direct browser AniList query failed, trying server proxy:", e);
    }
  }

  // 4) Server API proxy fetch (when SSR or direct AniList failed)
  try {
    const serverUrl = `/api/anime?category=${encodeURIComponent(category)}&page=${page}&genre=${encodeURIComponent(genre)}&q=${encodeURIComponent(q)}`;
    const serverRes = await fetch(serverUrl, { signal: AbortSignal.timeout(6000) });
    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData.success && Array.isArray(serverData.data?.items) && serverData.data.items.length > 0 && isCacheFromPrimarySources(serverData.data.items)) {
        const result = { items: serverData.data.items, hasMore: serverData.data.items.length > 0 };
        clientAnimeCache.set(cacheKey, { data: result, expires: Date.now() + CLIENT_ANIME_CACHE_TTL });
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(versionedKey, JSON.stringify({ data: result, expires: Date.now() + CLIENT_ANIME_CACHE_TTL }));
          } catch {}
        }
        return result;
      }
    }
  } catch { /* ignore server proxy error and try Kitsu */ }

  // 5) Direct browser Kitsu query fallback (when AniList is down)
    const kitsuResult = await fetchKitsuClientAnime(category, page, genre, q);
    if (kitsuResult.items.length > 0) {
      clientAnimeCache.set(cacheKey, { data: kitsuResult, expires: Date.now() + CLIENT_ANIME_CACHE_TTL });
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(`sv_client_${cacheKey}`, JSON.stringify({ data: kitsuResult, expires: Date.now() + CLIENT_ANIME_CACHE_TTL }));
        } catch {}
      }
    }
    return kitsuResult;
  }

