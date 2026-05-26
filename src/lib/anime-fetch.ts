// Multi-API Anime Fetcher
// Metadata: AniList (primary) + Jikan (fallback)
// Streaming: iframe embed sources only (no HLS)

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

export interface SeasonInfo {
  id: string;
  name: string;
  seasonLabel: string;
  totalEpisodes: number;
  isCurrent: boolean;
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

const LIST_QUERY = `query ($page: Int, $genre: String, $q: String) {
  Page(page: $page, perPage: 50) {
    media(
      type: ANIME,
      sort: [POPULARITY_DESC],
      genre: $genre,
      search: $q
    ) {
      id title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type
    }
  }
}`;

const TRENDING_QUERY = `query ($page: Int, $genre: String) {
  Page(page: $page, perPage: 50) {
    media(
      type: ANIME,
      sort: [TRENDING_DESC],
      genre: $genre
    ) {
      id title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type
    }
  }
}`;

const AIRING_QUERY = `query ($page: Int, $genre: String, $season: MediaSeason, $year: Int) {
  Page(page: $page, perPage: 50) {
    media(
      type: ANIME,
      sort: [POPULARITY_DESC],
      genre: $genre,
      season: $season,
      seasonYear: $year
    ) {
      id title { romaji english native } coverImage { large extraLarge }
      episodes genres averageScore description status type
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

export async function searchAnime(query: string, page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(LIST_QUERY, { page, q: query, genre: genre || null });
    return (data?.data?.Page?.media || []).map(transformAniList);
  } catch {
    return [];
  }
}

export async function getPopularAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(LIST_QUERY, { page, genre: genre || null, q: null });
    return (data?.data?.Page?.media || []).map(transformAniList);
  } catch {
    return [];
  }
}

export async function getTrendingAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(TRENDING_QUERY, { page, genre: genre || null });
    return (data?.data?.Page?.media || []).map(transformAniList);
  } catch {
    return [];
  }
}

export async function getAiringAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  const { season, year } = getCurrentSeason();
  try {
    const data = await anilistQuery(AIRING_QUERY, { page, genre: genre || null, season, year });
    return (data?.data?.Page?.media || []).map(transformAniList);
  } catch {
    return [];
  }
}

const RELATIONS_QUERY = `query ($id: Int) {
  Media(id: $id) {
    relations {
      edges {
        node {
          id
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

// Get anime details + related seasons via AniList + Jikan fallback
export async function getAnimeDetails(id: string): Promise<{
  anime: AnimeItem;
  episodes: { episodeId: string; episodeNum: number; title: string }[];
  totalEpisodes: number;
  seasons: SeasonInfo[];
} | null> {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;

  // Fetch main anime metadata
  let media: any = null;
  try {
    const q = `query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id title { romaji english native } coverImage { large extraLarge }
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
        if (a) {
          const episodes = Array.from({ length: Math.max(a.episodes || 12, 1) }, (_, i) => ({
            episodeId: `${id}-${i + 1}`,
            episodeNum: i + 1,
            title: `Episode ${i + 1}`,
          }));
          const totalEps = Math.max(a.episodes || 12, 1);
          return {
            anime: {
              id: String(a.mal_id),
              name: a.title_english || a.title || "Unknown",
              jname: a.title_japanese || null,
              poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "",
              type: a.type || "TV",
              episodes: { sub: a.episodes || null, dub: null },
              rating: a.score ? String(a.score) : null,
              description: a.synopsis || "",
              genres: a.genres?.map((g: any) => g.name) || [],
              status: a.status || null,
            },
            episodes,
            totalEpisodes: totalEps,
            seasons: [],
          };
        }
      }
    } catch { /* no fallback */ }
    return null;
  }

  const anime = transformAniList(media);

  // Fetch relations separately (don't fail main query if relations time out)
  let relatedSeasons: { id: number; title: string; episodes: number; season: string; seasonYear: number; format: string | null }[] = [];
  try {
    const relData = await anilistQuery(RELATIONS_QUERY, { id: numId });
    const edges = relData?.data?.Media?.relations?.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      if (node.type === "ANIME" && (edge.relationType === "SEQUEL" || edge.relationType === "PREQUEL")) {
        relatedSeasons.push({
          id: node.id,
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

  const seasons: SeasonInfo[] = allSeasons.map((s, i) => {
    const isMovie = s.format === "MOVIE" || s.format === "SPECIAL" || s.format === "OVA" || s.format === "ONA";
    const totalEp = isMovie
      ? Math.max(s.episodes || 1, 1)
      : Math.max(s.episodes || 12, 1);
    return {
      id: String(s.id),
      name: s.title,
      seasonLabel: `Season ${i + 1}`,
      totalEpisodes: totalEp,
      isCurrent: s.id === numId,
    };
  });

  const current = seasons.find(s => s.isCurrent) || seasons[0];
  const totalEpisodes = Math.max(current.totalEpisodes, isMovieFormat ? 1 : 12);

  const episodes = Array.from({ length: Math.min(totalEpisodes, 500) }, (_, i) => ({
    episodeId: `${id}-${i + 1}`,
    episodeNum: i + 1,
    title: `Episode ${i + 1}`,
  }));

  return { anime, episodes, totalEpisodes, seasons };
}

// Search via Jikan (fallback)
export async function searchViaJikan(query: string): Promise<AnimeItem[]> {
  try {
    const res = await fetch(
      `${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&limit=25&sfw`,
      { headers: { "User-Agent": "StreamVault/1.0" }, signal: AbortSignal.timeout(6000) }
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
    const result = await getAnimeDetails(id);
    if (result) {
      return {
        success: true,
        data: {
          ...result.anime,
          episodes: result.episodes,
          totalEpisodes: result.totalEpisodes,
          seasons: result.seasons,
        },
      };
    }
    throw new Error("Anime not found");
  }

  if (isSearch) {
    const keyword = params.get("keyword") || params.get("q") || "";
    let items = await searchAnime(keyword, page, genre);
    if (items.length === 0) {
      items = await searchViaJikan(keyword);
    }
    return { success: true, data: items };
  }

  if (isAiring) {
    const items = await getAiringAnime(page, genre);
    return { success: true, data: items };
  }

  if (isTrending) {
    const items = await getTrendingAnime(page, genre);
    return { success: true, data: items };
  }

  // default: popular
  const items = await getPopularAnime(page, genre);
  return { success: true, data: items };
}
