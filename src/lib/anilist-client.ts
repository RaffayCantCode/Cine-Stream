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
    if (s === "NOT_YET_RELEASED" || s === "CANCELLED") return false;
    if (s === "Not yet aired" || s === "Cancelled") return false;
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

export async function fetchClientAnime(category: string, page = 1, genre = "", q = ""): Promise<{ items: AnimeItem[], hasMore: boolean }> {
  try {
    let items: AnimeItem[] = [];
    if (category === "search" || q) {
      const data = await clientAnilistQuery(LIST_QUERY, { page, q, genre: genre || null });
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
    return { items, hasMore: items.length > 0 };
  } catch (e) {
    console.warn("AniList direct fetch failed, falling back to Jikan:", e);
    // Fallback to Jikan directly from client
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
    return { items, hasMore: items.length > 0 };
  }
}
