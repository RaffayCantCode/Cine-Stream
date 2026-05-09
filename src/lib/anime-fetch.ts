// Multi-API Anime Fetcher with Fallback Logic
// APIs included:
// 1. AnimeKAI API - https://animekai-api.vercel.app
// 2. Consumet API (GogoAnime) - https://api.consumet.org/anime/gogoanime
// 3. Anime-API by Abhay Thakur (AniWatch) - https://api-anime-rouge.vercel.app/aniwatch
// 4. Hianime API - https://hianime-api.vercel.app/api/v2/hianime

interface AnimeAPIConfig {
  name: string;
  baseUrl: string;
  type: "animekai" | "consumet" | "aniwatch" | "hianime";
}

const ANIME_APIS: AnimeAPIConfig[] = [
  {
    name: "AnimeKAI",
    baseUrl: "https://animekai-api.vercel.app",
    type: "animekai",
  },
  {
    name: "Consumet (GogoAnime)",
    baseUrl: "https://api.consumet.org/anime/gogoanime",
    type: "consumet",
  },
  {
    name: "Anime-API (AniWatch)",
    baseUrl: "https://api-anime-rouge.vercel.app/aniwatch",
    type: "aniwatch",
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
    case "animekai":
      return transformAnimeKAI(data);
    case "consumet":
      return transformConsumet(data);
    case "aniwatch":
      return transformAniWatch(data);
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
    case "animekai":
      return `${api.baseUrl}${endpoint}`;
    case "consumet":
      // Consumet uses different endpoints
      if (endpoint.startsWith("/search")) {
        const query = new URLSearchParams(endpoint.split("?")[1]).get("q") || "";
        return `${api.baseUrl}/${encodeURIComponent(query)}`;
      }
      if (endpoint === "/home" || endpoint === "/top-airing") {
        return `${api.baseUrl}/top-airing`;
      }
      if (endpoint === "/category/latest-updated") {
        return `${api.baseUrl}/recent-episodes`;
      }
      if (endpoint.startsWith("/anime/")) {
        const id = endpoint.replace("/anime/", "");
        return `${api.baseUrl}/info/${id}`;
      }
      if (endpoint.includes("/episodes")) {
        const id = endpoint.split("/")[2];
        return `${api.baseUrl}/info/${id}`;
      }
      return `${api.baseUrl}${endpoint}`;
    case "aniwatch":
      // AniWatch uses different structure
      if (endpoint.startsWith("/api/search")) {
        const params = new URLSearchParams(endpoint.split("?")[1]);
        const keyword = params.get("keyword") || "";
        return `${api.baseUrl}/search?keyword=${encodeURIComponent(keyword)}`;
      }
      if (endpoint === "/home") {
        return `${api.baseUrl}/home`;
      }
      if (endpoint.startsWith("/category/")) {
        const category = endpoint.replace("/category/", "").split("?")[0];
        return `${api.baseUrl}/${category}`;
      }
      if (endpoint.startsWith("/api/anime/")) {
        const id = endpoint.replace("/api/anime/", "");
        return `${api.baseUrl}/anime/${id}`;
      }
      if (endpoint.startsWith("/api/episodes/")) {
        const id = endpoint.replace("/api/episodes/", "");
        return `${api.baseUrl}/episodes/${id}`;
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
        case "animekai":
          url = `${api.baseUrl}/api/servers/${episodeId}`;
          break;
        case "consumet":
          url = `${api.baseUrl}/watch/${episodeId}`;
          break;
        case "aniwatch":
          url = `${api.baseUrl}/servers/${episodeId}`;
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
