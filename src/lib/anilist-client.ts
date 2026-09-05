import { AnimeItem } from "@/components/AnimeCard";
import { cleanAnimeDescription } from "@/lib/anime-fetch";
import { fetchKitsuClientAnime } from "@/lib/kitsu";

const ANILIST_API = "https://graphql.anilist.co";


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
  Page(page: $page, perPage: 20) {
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
const CLIENT_CACHE_VERSION = "v32-anime-section-update";

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

export async function fetchClientAnime(category: string, page = 1, genre = "", q = ""): Promise<{ items: AnimeItem[], hasMore: boolean }> {
  const cacheKey = `anime_${category}_${page}_${genre}_${q}`;
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
      if (category === "search" || q) {
        const data = await clientAnilistQuery(SEARCH_QUERY, { page, q, genre: genre || null });
        items = (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
      } else if (category === "airing") {
        const { season, year } = getCurrentSeason();
        const data = await clientAnilistQuery(AIRING_QUERY, { page, genre: genre || null, season, year });
        items = (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
      } else if (category === "trending") {
        const data = await clientAnilistQuery(TRENDING_QUERY, { page, genre: genre || null });
        items = (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
      } else {
        const data = await clientAnilistQuery(LIST_QUERY, { page, genre: genre || null, q: null });
        items = (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
      }
      
      items = filterUnreleased(deduplicateAnime(items));
      if (items.length > 0) {
        const result = { items, hasMore: items.length > 0 };
        clientAnimeCache.set(cacheKey, { data: result, expires: Date.now() + CLIENT_ANIME_CACHE_TTL });
        try {
          sessionStorage.setItem(versionedKey, JSON.stringify({ data: result, expires: Date.now() + CLIENT_ANIME_CACHE_TTL }));
        } catch {}
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

