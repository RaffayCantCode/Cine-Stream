// Multi-API Anime Fetcher
// Metadata: AniList (primary) + Jikan (fallback)
// Streaming: iframe embed sources only (no HLS)

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

export async function searchAnime(query: string, page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(LIST_QUERY, { page, q: query, genre: genre || null });
    return (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
  } catch {
    return [];
  }
}

export async function getPopularAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(LIST_QUERY, { page, genre: genre || null, q: null });
    return (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
  } catch {
    return [];
  }
}

export async function getTrendingAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  try {
    const data = await anilistQuery(TRENDING_QUERY, { page, genre: genre || null });
    return (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
  } catch {
    return [];
  }
}

export async function getAiringAnime(page = 1, genre?: string): Promise<AnimeItem[]> {
  const { season, year } = getCurrentSeason();
  try {
    const data = await anilistQuery(AIRING_QUERY, { page, genre: genre || null, season, year });
    return (data?.data?.Page?.media || []).map(transformAniList).filter(Boolean) as AnimeItem[];
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
  episodes: EpisodeDetail[];
  totalEpisodes: number;
  seasons: SeasonInfo[];
} | null> {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;

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
          const realEps = await fetchEpisodesFromJikan(numId, String(numId), totalEps);
          if (realEps) episodes = realEps;

          const existingNums = new Set(episodes.map(e => e.episodeNum));
          for (let i = 1; i <= totalEps; i++) {
            if (!existingNums.has(i)) {
              episodes.push({
                episodeId: `${id}-${i}`,
                episodeNum: i,
                title: `Episode ${i}`,
                description: null,
                thumbnail: null,
                releasedDate: null,
                isFiller: false,
                isRecap: false,
              });
            }
          }
          episodes.sort((a, b) => a.episodeNum - b.episodeNum);
          return {
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
        }
      }
    } catch { /* no fallback */ }
    return null;
  }

  const anime = transformAniList(media);
  if (!anime) return null;

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

  let episodes: EpisodeDetail[] = [];
  if (media.idMal) {
    const realEps = await fetchEpisodesFromJikan(media.idMal, id, totalEpisodes);
    if (realEps) episodes = realEps;
  }

  const existingNums = new Set(episodes.map(e => e.episodeNum));
  for (let i = 1; i <= Math.min(totalEpisodes, 500); i++) {
    if (!existingNums.has(i)) {
      episodes.push({
        episodeId: `${id}-${i}`,
        episodeNum: i,
        title: `Episode ${i}`,
        description: null,
        thumbnail: null,
        releasedDate: null,
        isFiller: false,
        isRecap: false,
      });
    }
  }
  episodes.sort((a, b) => a.episodeNum - b.episodeNum);

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

// Fetch real episode metadata (titles, thumbnails, airdates) from Jikan
async function fetchEpisodesFromJikan(
  malId: number | string,
  anilistId: string,
  maxEpisodes: number
): Promise<EpisodeDetail[] | null> {
  try {
    const allEps: EpisodeDetail[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && allEps.length < maxEpisodes) {
      const res = await fetch(
        `${JIKAN_BASE}/anime/${malId}/episodes?page=${page}`,
        { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "StreamVault/1.0" } }
      );
      if (!res.ok) break;

      const data = await res.json();
      const pageEps = data.data || [];
      if (pageEps.length === 0) break;

      for (const ep of pageEps) {
        const epNum = ep.mal_id;
        if (!epNum || epNum > maxEpisodes) continue;
        allEps.push({
          episodeId: `${anilistId}-${epNum}`,
          episodeNum: epNum,
          title: ep.title || `Episode ${epNum}`,
          description: null,
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
