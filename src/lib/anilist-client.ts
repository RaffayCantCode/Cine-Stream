import { AnimeItem } from "@/components/AnimeCard";

const ANILIST_API = "https://graphql.anilist.co";
const JIKAN_BASE = "https://api.jikan.moe/v4";

const LIST_QUERY = `query ($page: Int, $genre: String, $q: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], genre: $genre, search: $q) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear
    }
  }
}`;

const SEARCH_QUERY = `query ($page: Int, $genre: String, $q: String) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, genre: $genre, search: $q) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear
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

const AIRING_QUERY = `query ($page: Int, $genre: String, $season: MediaSeason, $year: Int) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], genre: $genre, season: $season, seasonYear: $year) {
      id idMal isAdult title { romaji english native } coverImage { large extraLarge }
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
  } as AnimeItem;
}

function transformJikan(a: any): AnimeItem {
  return {
    id: String(a.mal_id),
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
    season: a.season || null,
    seasonYear: a.year || null,
    format: a.type || null,
    duration: a.duration ? parseInt(a.duration) : null,
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

async function clientAnilistQuery(query: string, variables: Record<string, any>): Promise<any> {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList returned ${res.status}`);
  return res.json();
}

const clientAnimeCache = new Map<string, { data: { items: AnimeItem[]; hasMore: boolean }; expires: number }>();
const CLIENT_ANIME_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchClientAnime(category: string, page = 1, genre = "", q = ""): Promise<{ items: AnimeItem[], hasMore: boolean }> {
  const cacheKey = `anime_${category}_${page}_${genre}_${q}`;

  // 1) In-memory cache check (only if items exist!)
  const cachedMemory = clientAnimeCache.get(cacheKey);
  if (cachedMemory && cachedMemory.expires > Date.now() && cachedMemory.data.items?.length > 0) {
    return cachedMemory.data;
  }

  // 2) sessionStorage check (only if items exist!)
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(`sv_client_${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.expires > Date.now() && parsed.data?.items?.length > 0) {
          clientAnimeCache.set(cacheKey, parsed);
          return parsed.data;
        }
      }
    } catch {}
  }

  // 3) Server API proxy fetch first (runs reliably on Cloudflare server Edge)
  try {
    const serverUrl = `/api/anime?category=${encodeURIComponent(category)}&page=${page}&genre=${encodeURIComponent(genre)}&q=${encodeURIComponent(q)}`;
    const serverRes = await fetch(serverUrl, { signal: AbortSignal.timeout(6000) });
    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData.success && Array.isArray(serverData.data?.items) && serverData.data.items.length > 0) {
        const result = { items: serverData.data.items, hasMore: serverData.data.items.length > 0 };
        clientAnimeCache.set(cacheKey, { data: result, expires: Date.now() + CLIENT_ANIME_CACHE_TTL });
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(`sv_client_${cacheKey}`, JSON.stringify({ data: result, expires: Date.now() + CLIENT_ANIME_CACHE_TTL }));
          } catch {}
        }
        return result;
      }
    }
  } catch { /* ignore server proxy error and try direct client query */ }

  // 4) Direct browser query fallback (AniList / Jikan)
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
    const result = { items, hasMore: items.length > 0 };

    if (items.length > 0) {
      clientAnimeCache.set(cacheKey, { data: result, expires: Date.now() + CLIENT_ANIME_CACHE_TTL });
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(`sv_client_${cacheKey}`, JSON.stringify({ data: result, expires: Date.now() + CLIENT_ANIME_CACHE_TTL }));
        } catch {}
      }
    }
    return result;
  } catch (e) {
    console.warn("AniList direct fetch failed, falling back to Jikan:", e);
    let url = `${JIKAN_BASE}/top/anime?filter=bypopularity&page=${page}`;
    if (category === "search" || q) {
      url = `${JIKAN_BASE}/anime?q=${encodeURIComponent(q)}&page=${page}${genre ? `&genres=${genre}` : ""}`;
    } else if (category === "airing") {
      url = `${JIKAN_BASE}/seasons/now?page=${page}`;
    } else if (category === "trending") {
      url = `${JIKAN_BASE}/top/anime?filter=airing&page=${page}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    const items = filterUnreleased(deduplicateAnime((data.data || []).map(transformJikan)));
    const fallbackResult = { items, hasMore: items.length > 0 };
    if (items.length > 0) {
      clientAnimeCache.set(cacheKey, { data: fallbackResult, expires: Date.now() + CLIENT_ANIME_CACHE_TTL });
    }
    return fallbackResult;
  }
}
