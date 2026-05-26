// Multi-API Anime Fetcher
// Metadata: AniList (primary) + Jikan (fallback)
// Streaming: Kiwi API + iframe embed sources
// Self-hosted: Consumet (configurable)

export interface AnimeItem {
  id: string;
  name: string;
  jname?: string | null;
  poster: string;
  type?: string | null;
  episodes?: { sub: number | null; dub: number | null };
  rating?: string | null;
  description?: string;
  genres?: string[];
  status?: string | null;
}

interface AniListMedia {
  id: number;
  title: { romaji: string; english: string | null; native: string | null };
  coverImage: { large: string; extraLarge: string };
  episodes: number | null;
  genres: string[];
  averageScore: number | null;
  description: string | null;
  status: string | null;
  type: string | null;
  season: string | null;
  seasonYear: number | null;
}

const ANILIST_API = "https://graphql.anilist.co";
const JIKAN_BASE = "https://api.jikan.moe/v4";
const KIWI_BASE = "https://animefreestream.vercel.app/anime/zoro";

// Configurable self-hosted Consumet endpoint
const SELF_HOSTED_CONSUMET = process.env.NEXT_PUBLIC_CONSUMET_URL || "";

function anilistQuery(query: string, variables: Record<string, any>): Promise<any> {
  return fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10000),
  }).then((r) => r.json());
}

function transformAniList(media: AniListMedia): AnimeItem {
  return {
    id: String(media.id),
    name: media.title.english || media.title.romaji,
    jname: media.title.native || null,
    poster: media.coverImage?.extraLarge || media.coverImage?.large || "",
    type: media.type || "TV",
    episodes: { sub: media.episodes || null, dub: null },
    rating: media.averageScore ? String(media.averageScore / 10) : null,
    description: media.description?.replace(/<[^>]*>/g, "") || "",
    genres: media.genres || [],
    status: media.status || null,
  };
}

// Search anime via AniList
export async function searchAnime(query: string, page = 1): Promise<AnimeItem[]> {
  const q = `query ($q: String, $page: Int) {
    Page(page: $page, perPage: 50) {
      media(search: $q, type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english native } coverImage { large extraLarge }
        episodes genres averageScore description status type
      }
    }
  }`;
  try {
    const data = await anilistQuery(q, { q: query, page });
    return (data?.data?.Page?.media || []).map(transformAniList);
  } catch {
    return [];
  }
}

// Get popular anime via AniList
export async function getPopularAnime(page = 1): Promise<AnimeItem[]> {
  const q = `query ($page: Int) {
    Page(page: $page, perPage: 50) {
      media(type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english native } coverImage { large extraLarge }
        episodes genres averageScore description status type
      }
    }
  }`;
  try {
    const data = await anilistQuery(q, { page });
    return (data?.data?.Page?.media || []).map(transformAniList);
  } catch {
    return [];
  }
}

// Get trending/airing anime via AniList
export async function getTrendingAnime(page = 1): Promise<AnimeItem[]> {
  const q = `query ($page: Int) {
    Page(page: $page, perPage: 50) {
      media(type: ANIME, sort: TRENDING_DESC) {
        id title { romaji english native } coverImage { large extraLarge }
        episodes genres averageScore description status type
      }
    }
  }`;
  try {
    const data = await anilistQuery(q, { page });
    return (data?.data?.Page?.media || []).map(transformAniList);
  } catch {
    return [];
  }
}

// Get currently airing anime via AniList
export async function getAiringAnime(page = 1): Promise<AnimeItem[]> {
  const now = new Date();
  const year = now.getFullYear();
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const season = seasons[Math.floor(now.getMonth() / 3)];

  const q = `query ($season: MediaSeason, $year: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      media(season: $season, seasonYear: $year, type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english native } coverImage { large extraLarge }
        episodes genres averageScore description status type
      }
    }
  }`;
  try {
    const data = await anilistQuery(q, { season, year, page });
    return (data?.data?.Page?.media || []).map(transformAniList);
  } catch {
    return [];
  }
}

// Get anime details via AniList + Kiwi streaming IDs
export async function getAnimeDetails(id: string): Promise<{
  anime: AnimeItem;
  episodes: { episodeId: string; episodeNum: number; title: string }[];
  totalEpisodes: number;
} | null> {
  // Get metadata from AniList
  const q = `query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type
    }
  }`;

  try {
    const numId = parseInt(id, 10);
    const data = await anilistQuery(q, { id: isNaN(numId) ? 1 : numId });
    const media = data?.data?.Media;
    if (!media) return null;

    const anime = transformAniList(media);

    // Try to get streaming episodes from Kiwi API
    let episodes: { episodeId: string; episodeNum: number; title: string }[] = [];
    let totalEpisodes = media.episodes || 0;

    try {
      const searchName = anime.name.toLowerCase().replace(/[^\w\s]/g, "").slice(0, 30);
      const searchRes = await fetch(
        `${KIWI_BASE}/${encodeURIComponent(searchName)}?page=1`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const match = (searchData.results || [])[0];
        if (match?.id) {
          const infoRes = await fetch(
            `${KIWI_BASE}/info?id=${encodeURIComponent(match.id)}`,
            { signal: AbortSignal.timeout(15000) }
          );
          if (infoRes.ok) {
            const infoData = await infoRes.json();
            episodes = (infoData.episodes || []).map((ep: any, i: number) => ({
              episodeId: ep.id || `${match.id}-${i + 1}`,
              episodeNum: ep.number || i + 1,
              title: ep.title || `Episode ${ep.number || i + 1}`,
            }));
            totalEpisodes = infoData.totalEpisodes || episodes.length || totalEpisodes;
          }
        }
      }
    } catch {
      // Kiwi search failed - use placeholder episodes
    }

    // If no Kiwi episodes, generate placeholder
    if (episodes.length === 0 && totalEpisodes > 0) {
      episodes = Array.from({ length: Math.min(totalEpisodes, 500) }, (_, i) => ({
        episodeId: `${id}-${i + 1}`,
        episodeNum: i + 1,
        title: `Episode ${i + 1}`,
      }));
    }

    return { anime, episodes, totalEpisodes };
  } catch {
    return null;
  }
}

// Search via Jikan (fallback for AniList failures)
export async function searchViaJikan(query: string): Promise<AnimeItem[]> {
  try {
    const res = await fetch(
      `${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&limit=25&sfw`,
      { headers: { "User-Agent": "StreamVault/1.0" }, signal: AbortSignal.timeout(8000) }
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

// Main fetch function for the API routes
export async function fetchAnimeApi(
  endpoint: string,
  isDetail = false
): Promise<any> {
  // Parse endpoint to determine action
  const isSearch = endpoint.includes("/search") || endpoint.includes("keyword=");
  const isPopular = endpoint.includes("/popular") || endpoint.includes("/home");
  const isLatest = endpoint.includes("/latest") || endpoint.includes("recent");
  const isSeries = endpoint.startsWith("/series/");
  const isWatch = endpoint.startsWith("/watch/");

  if (isDetail || isSeries) {
    const id = endpoint.replace("/series/", "").split("?")[0];
    const result = await getAnimeDetails(id);
    if (result) {
      return {
        success: true,
        data: {
          ...result.anime,
          episodes: result.episodes,
          totalEpisodes: result.totalEpisodes,
        },
      };
    }
    throw new Error("Anime not found");
  }

  if (isSearch) {
    const params = new URLSearchParams(endpoint.split("?")[1]);
    const keyword = params.get("keyword") || params.get("q") || "";
    let items = await searchAnime(keyword);
    if (items.length === 0) {
      items = await searchViaJikan(keyword);
    }
    return { success: true, data: items };
  }

  if (isPopular) {
    const items = await getPopularAnime(1);
    if (items.length === 0) {
      const jikan = await searchViaJikan("top");
      return { success: true, data: jikan };
    }
    return { success: true, data: items };
  }

  if (isLatest) {
    const items = await getAiringAnime(1);
    return { success: true, data: items };
  }

  // Default: trending
  const items = await getTrendingAnime(1);
  return { success: true, data: items };
}

// Get streaming source for an episode
export async function getStreamingSource(
  animeId: string,
  episodeId: string,
  _server = "default"
): Promise<any> {
  // Try self-hosted Consumet first
  if (SELF_HOSTED_CONSUMET) {
    try {
      const res = await fetch(
        `${SELF_HOSTED_CONSUMET}/anime/gogoanime/watch/${encodeURIComponent(episodeId)}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (res.ok) {
        const data = await res.json();
        const sources = data.sources || [];
        const subtitles = data.subtitles || [];
        if (sources.length > 0) {
          return {
            success: true,
            data: {
              sources: sources.map((s: any) => ({ url: s.url, quality: s.quality || "Auto" })),
              subtitles: subtitles.map((s: any) => ({ url: s.url, lang: s.lang || "English" })),
            },
            source: "Consumet",
          };
        }
      }
    } catch { /* fall through */ }
  }

  // Try Kiwi API
  try {
    const url = `${KIWI_BASE}/watch/${encodeURIComponent(episodeId)}?server=vidcloud`;
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (res.ok) {
      const data = await res.json();
      const sources = data.sources || data.data?.sources || [];
      const subtitles = data.subtitles || data.data?.subtitles || [];

      if (sources.length > 0) {
        return {
          success: true,
          data: {
            sources: sources.map((s: any) => ({ url: s.url, quality: s.quality || "Auto" })),
            subtitles: subtitles.map((s: any) => ({ url: s.url, lang: s.lang || "English" })),
          },
          source: "Kiwi",
        };
      }
    }
  } catch { /* fall through */ }

  // No streaming sources available
  throw new Error("No streaming sources available");
}
