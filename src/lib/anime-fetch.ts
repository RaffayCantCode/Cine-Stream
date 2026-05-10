// Multi-API Anime Fetcher with Fallback Logic
// APIs included:
// 1. AniPub API - https://api.anipub.xyz
// 2. Tatakai API - https://api.tatakai.me
// 3. DropFile API - https://dropfile.cc
// 4. Hianime API - https://hianime-api.vercel.app/api/v2/hianime (fallback)

interface AnimeAPIConfig {
  name: string;
  baseUrl: string;
  type: "anipub" | "tatakai" | "dropfile" | "hianime";
}

const ANIME_APIS: AnimeAPIConfig[] = [
  {
    name: "AniPub",
    baseUrl: "https://api.anipub.xyz",
    type: "anipub",
  },
  {
    name: "Tatakai",
    baseUrl: "https://api.tatakai.me",
    type: "tatakai",
  },
  {
    name: "DropFile",
    baseUrl: "https://dropfile.cc",
    type: "dropfile",
  },
  {
    name: "Hianime",
    baseUrl: "https://hianime-api.vercel.app/api/v2/hianime",
    type: "hianime",
  },
];

// Unified Anime Item interface
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
}

// Transform different API responses to unified format
function transformResponse(apiType: string, data: any): any {
  switch (apiType) {
    case "anipub":
      return transformAniPub(data);
    case "tatakai":
      return transformTatakai(data);
    case "dropfile":
      return transformDropFile(data);
    case "hianime":
      return transformHianime(data);
    default:
      return data;
  }
}

function transformAnimeKAI(data: any): any {
  // If it's a search response
  if (data.results || data.data) {
    const items = (data.results || data.data || []).map((item: any) => ({
      id: item.slug || item.id || "",
      name: item.title || item.name || "Unknown",
      jname: item.japanese_title || item.jname || null,
      poster: item.poster || item.image || item.cover || "",
      type: item.type || item.format || "TV",
      episodes: {
        sub: item.episodes?.sub || item.episode_count || null,
        dub: item.episodes?.dub || null,
      },
      rating: item.rating || null,
      description: item.description || item.synopsis || "",
      genres: item.genres || [],
    }));
    return { success: true, data: items };
  }
  return data;
}

function transformConsumet(data: any): any {
  // Consumet returns array for list endpoints
  if (Array.isArray(data)) {
    const items = data.map((item: any) => ({
      id: item.id || "",
      name: item.title || "Unknown",
      jname: null,
      poster: item.image || "",
      type: item.subOrDub || "sub",
      episodes: {
        sub: item.episodes || item.episodeCount || null,
        dub: null,
      },
      rating: null,
      description: "",
      genres: item.genres || [],
    }));
    return { success: true, data: items };
  }
  return data;
}

function transformAniWatch(data: any): any {
  if (data.animes || data.results || data.data) {
    const items = (data.animes || data.results || data.data || []).map((item: any) => ({
      id: item.id || item.slug || "",
      name: item.name || item.title || "Unknown",
      jname: item.jname || item.japanese_title || null,
      poster: item.poster || item.img || item.image || item.cover || "",
      type: item.type || "TV",
      episodes: {
        sub: item.episodes?.sub || item.episode_count || null,
        dub: item.episodes?.dub || null,
      },
      rating: null,
      description: item.description || "",
      genres: item.genres || [],
    }));
    return { success: true, data: items };
  }
  return data;
}

// Transform AniPub API response
function transformAniPub(data: any): any {
  // AniPub returns detailed anime info
  if (data.local || data.title) {
    // Single anime response
    const item = {
      id: data._id || data.id || "",
      name: data.title || data.name || "Unknown",
      jname: data.japanese_title || data.jname || null,
      poster: data.poster || data.cover || data.image || "",
      type: data.type || data.format || "TV",
      episodes: {
        sub: data.episodes?.sub || data.episode_count || null,
        dub: data.episodes?.dub || null,
      },
      rating: data.rating || data.score || null,
      description: data.description || data.synopsis || data.summary || "",
      genres: data.genres || [],
    };
    return { success: true, data: [item] };
  }
  
  // Search/browse response
  if (data.results || data.data || Array.isArray(data)) {
    const items = (data.results || data.data || data || []).map((item: any) => ({
      id: item._id || item.id || item.slug || "",
      name: item.title || item.name || "Unknown",
      jname: item.japanese_title || item.jname || null,
      poster: item.poster || item.cover || item.image || "",
      type: item.type || item.format || "TV",
      episodes: {
        sub: item.episodes?.sub || item.episode_count || null,
        dub: item.episodes?.dub || null,
      },
      rating: item.rating || item.score || null,
      description: item.description || item.synopsis || item.summary || "",
      genres: item.genres || [],
    }));
    return { success: true, data: items };
  }
  return data;
}

// Transform Tatakai API response
function transformTatakai(data: any): any {
  // Tatakai API structure
  if (data.anime || data.results || data.data) {
    const items = (data.anime || data.results || data.data || []).map((item: any) => ({
      id: item.id || item.mal_id || item.anilist_id || "",
      name: item.title || item.name || "Unknown",
      jname: item.japanese_title || item.jname || null,
      poster: item.poster || item.image || item.cover || "",
      type: item.type || item.format || "TV",
      episodes: {
        sub: item.episodes?.sub || item.episode_count || null,
        dub: item.episodes?.dub || null,
      },
      rating: item.rating || item.score || item.score_avg || null,
      description: item.description || item.synopsis || item.summary || "",
      genres: item.genres || [],
    }));
    return { success: true, data: items };
  }
  return data;
}

// Transform DropFile API response
function transformDropFile(data: any): any {
  // DropFile returns embed data
  if (data.anime && data.stream) {
    // Single anime with stream data
    const item = {
      id: data.anime.ids?.mal || data.anime.ids?.anilist || data.anime.ids?.imdb || "",
      name: data.anime.title || "Unknown",
      jname: null, // DropFile doesn't provide Japanese name
      poster: "", // Would need to fetch separately
      type: data.anime.type || "TV",
      episodes: {
        sub: null, // Would need episode-specific calls
        dub: null,
      },
      rating: null,
      description: "",
      genres: [],
    };
    return { success: true, data: [item] };
  }
  
  // Search response
  if (data.results || data.data || Array.isArray(data)) {
    const items = (data.results || data.data || data || []).map((item: any) => ({
      id: item.ids?.mal || item.ids?.anilist || item.ids?.imdb || item.id || "",
      name: item.title || item.name || "Unknown",
      jname: null,
      poster: "",
      type: item.type || "TV",
      episodes: {
        sub: null,
        dub: null,
      },
      rating: null,
      description: "",
      genres: [],
    }));
    return { success: true, data: items };
  }
  return data;
}

function transformHianime(data: any): any {
  if (data.data) {
    // Handle hianime structure
    const extractAnimes = (section: any[]) => {
      return (section || []).map((item: any) => ({
        id: item.id || "",
        name: item.name || "Unknown",
        jname: item.jname || null,
        poster: item.poster || "",
        type: item.type || "TV",
        episodes: {
          sub: item.episodes?.sub || null,
          dub: item.episodes?.dub || null,
        },
        rating: null,
        description: item.description || "",
        genres: item.genres || [],
      }));
    };

    const spotlightAnimes = extractAnimes(data.data.spotlightAnimes);
    const latestEpisodeAnimes = extractAnimes(data.data.latestEpisodeAnimes);
    const newReleases = extractAnimes(data.data.newReleases);

    return {
      success: true,
      data: {
        spotlightAnimes,
        latestEpisodeAnimes,
        newReleases,
      },
    };
  }
  return data;
}

// Build endpoint URL based on API type
function buildEndpoint(api: AnimeAPIConfig, endpoint: string): string {
  switch (api.type) {
    case "anipub":
      // AniPub API endpoints
      if (endpoint === "/home") {
        return `${api.baseUrl}/api/anime/trending?limit=20`;
      }
      if (endpoint.startsWith("/api/search")) {
        const params = new URLSearchParams(endpoint.split("?")[1]);
        const keyword = params.get("keyword") || params.get("q") || "";
        return `${api.baseUrl}/api/search/${encodeURIComponent(keyword)}`;
      }
      if (endpoint.startsWith("/api/find/")) {
        const id = endpoint.replace("/api/find/", "");
        return `${api.baseUrl}/api/find/${id}`;
      }
      if (endpoint.startsWith("/api/findbyGenre/")) {
        const genre = endpoint.replace("/api/findbyGenre/", "").split("?")[0];
        const page = new URLSearchParams(endpoint.split("?")[1]).get("page") || "1";
        return `${api.baseUrl}/api/findbyGenre/${genre}?Page=${page}`;
      }
      return `${api.baseUrl}${endpoint}`;
    case "tatakai":
      // Tatakai API endpoints
      if (endpoint === "/home") {
        return `${api.baseUrl}/api/v1/hianime/home`;
      }
      if (endpoint.startsWith("/api/search")) {
        const params = new URLSearchParams(endpoint.split("?")[1]);
        const keyword = params.get("keyword") || params.get("q") || "";
        return `${api.baseUrl}/api/v1/anime/search?q=${encodeURIComponent(keyword)}`;
      }
      if (endpoint.startsWith("/api/v1/hianime/home")) {
        return `${api.baseUrl}${endpoint}`;
      }
      return `${api.baseUrl}${endpoint}`;
    case "dropfile":
      // DropFile API endpoints - mainly for embedding
      if (endpoint.startsWith("/api/anime/embed/")) {
        // Extract TV/movie, id, season, episode from path
        const parts = endpoint.split("/");
        if (parts.length >= 6 && parts[3] === "tv") {
          const type = parts[2]; // tv or movie
          const idSource = parts[4]; // mal-21, anilist-154587, etc
          const season = parts[5];
          const episode = parts[6].split("?")[0]; // Remove query params
          const queryParams = parts[6].split("?")[1] || "";
          return `${api.baseUrl}/api/anime/embed/${type}/${idSource}/${season}/${episode}?${queryParams}`;
        }
        return `${api.baseUrl}${endpoint}`;
      }
      // For search, we'll use a different approach since DropFile is mainly for embeds
      if (endpoint.startsWith("/api/search")) {
        const params = new URLSearchParams(endpoint.split("?")[1]);
        const keyword = params.get("keyword") || params.get("q") || "";
        return `${api.baseUrl}/api/anime/search?q=${encodeURIComponent(keyword)}`;
      }
      return `${api.baseUrl}${endpoint}`;
    case "hianime":
      // Hianime uses v2 structure
      if (endpoint.startsWith("/api/")) {
        return `${api.baseUrl}${endpoint.replace("/api", "")}`;
      }
      return `${api.baseUrl}${endpoint}`;
    default:
      return `${api.baseUrl}${endpoint}`;
  }
}

export async function fetchAnimeApi(endpoint: string, options?: RequestInit): Promise<any> {
  const errors: string[] = [];

  for (const api of ANIME_APIS) {
    try {
      const url = buildEndpoint(api, endpoint);
      console.log(`[Anime API] Trying ${api.name}: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "StreamVault/1.0",
          ...options?.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`${api.name} returned ${res.status} ${res.statusText}`);
      }

      const data = await res.json();

      // Transform response based on API type
      const transformed = transformResponse(api.type, data);

      console.log(`[Anime API] ✅ ${api.name} succeeded`);
      return transformed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.warn(`[Anime API] ❌ ${api.name} failed:`, message);
      errors.push(`${api.name}: ${message}`);
      continue; // Try next API
    }
  }

  // All APIs failed
  console.error("[Anime API] All APIs failed:", errors);
  throw new Error(`All Anime APIs failed. Errors: ${errors.join(" | ")}`);
}

// Fetch with specific API preference
export async function fetchAnimeApiWithPreference(
  endpoint: string,
  preferredApi: string,
  options?: RequestInit
): Promise<any> {
  const api = ANIME_APIS.find((a) => a.name.toLowerCase().includes(preferredApi.toLowerCase()));
  if (api) {
    const url = buildEndpoint(api, endpoint);
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "User-Agent": "StreamVault/1.0",
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(`${api.name} returned ${res.status}`);
    const data = await res.json();
    return transformResponse(api.type, data);
  }
  return fetchAnimeApi(endpoint, options);
}

// Get streaming source for an episode
export async function getStreamingSource(
  animeId: string,
  episodeId: string,
  server: string = "default"
): Promise<any> {
  const errors: string[] = [];

  for (const api of ANIME_APIS) {
    try {
      let url: string;

      switch (api.type) {
        case "anipub":
          // AniPub provides streaming links via getStreamingLinks equivalent
          // We'd need to construct the appropriate endpoint
          url = `${api.baseUrl}/v1/api/details/${episodeId}`;
          break;
        case "tatakai":
          // Tatakai API for episodes
          url = `${api.baseUrl}/api/v1/anime/${animeId}/episode/${episodeId}`;
          break;
        case "dropfile":
          // DropFile for direct embed URLs
          url = `${api.baseUrl}/api/anime/embed/tv/${animeId}/1/${episodeId}?audio=sub&lang=en`;
          break;
        case "hianime":
          url = `${api.baseUrl}/episode/servers?animeEpisodeId=${episodeId}`;
          break;
        default:
          continue;
      }

      console.log(`[Streaming] Trying ${api.name}: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "StreamVault/1.0",
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`${api.name} returned ${res.status}`);
      }

      const data = await res.json();
      console.log(`[Streaming] ✅ ${api.name} succeeded`);
      return { success: true, data, source: api.name };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.warn(`[Streaming] ❌ ${api.name} failed:`, message);
      errors.push(`${api.name}: ${message}`);
      continue;
    }
  }

  console.error("[Streaming] All APIs failed:", errors);
  throw new Error(`All streaming sources failed. Errors: ${errors.join(" | ")}`);
}
