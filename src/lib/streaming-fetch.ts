interface StreamingAPIConfig {
  name: string;
  baseUrl: string;
  type: string;
  quality: "Best" | "Stable" | "Good" | "Backup";
  supportsNativeFullscreen?: boolean;
  healthCheckUrl?: string;
}

const STREAMING_APIS: StreamingAPIConfig[] = [
  {
    name: "Source 1",
    baseUrl: "https://vidsrc.me",
    type: "vidsrc",
    quality: "Stable",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidsrc.me",
  },
  {
    name: "Source 2",
    baseUrl: "https://embedmaster.link",
    type: "embedmaster",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://embedmaster.link",
  },
  {
    name: "Source 3",
    baseUrl: "https://vixsrc.to",
    type: "vixsrc",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vixsrc.to",
  },
  {
    name: "Source 4",
    baseUrl: "https://vidlink.pro",
    type: "vidlink",
    quality: "Good",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidlink.pro",
  },
  {
    name: "Source 5",
    baseUrl: "https://autoembed.co",
    type: "autoembed",
    quality: "Backup",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://autoembed.co",
  },
];

function buildEmbedUrl(api: StreamingAPIConfig, type: "movie" | "tv", id: number, season?: number, episode?: number, progress?: number): string {
  switch (api.type) {
    case "embedmaster":
      if (type === "movie") return `${api.baseUrl}/movie/${id}`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vixsrc":
      if (type === "movie") return `${api.baseUrl}/movie/${id}`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidlink":
      if (type === "movie") return `${api.baseUrl}/movie/${id}`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidsrc":
      if (type === "movie") return `${api.baseUrl}/embed/movie?tmdb=${id}`;
      return `${api.baseUrl}/embed/tv?tmdb=${id}&season=${season ?? 1}&episode=${episode ?? 1}`;

    case "autoembed":
      if (type === "movie") return `${api.baseUrl}/movie/tmdb/${id}?color=8B5CF6&lang=en`;
      return `${api.baseUrl}/tv/tmdb/${id}-${season ?? 1}-${episode ?? 1}?color=8B5CF6&lang=en`;

    case "videasy":
      if (type === "movie") return `https://vidnest.fun/movie/${id}`;
      return `https://vidnest.fun/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    default:
      return "";
  }
}

export interface StreamingSource {
  url: string;
  name: string;
  type: string;
  quality: "Best" | "Stable" | "Good" | "Backup";
  tag?: string;
  supportsNativeFullscreen?: boolean;
}

// Default provider order for movies/TV (source of truth for the admin config).
export function getDefaultMovieOrder(): string[] {
  return STREAMING_APIS.map((api) => api.type);
}

export function getStreamingSources(type: "movie" | "tv", id: number, season?: number, episode?: number, progress?: number): StreamingSource[] {
  return STREAMING_APIS.map((api) => ({
    url: buildEmbedUrl(api, type, id, season, episode, progress),
    name: api.name,
    type: api.type,
    quality: api.quality,
    supportsNativeFullscreen: api.supportsNativeFullscreen,
  }));
}

export function getFallbackEmbedUrl(type: "movie" | "tv", id: number, season?: number, episode?: number): string {
  return `https://vidsrc.me/embed/${type === "movie" ? "movie?tmdb=" : "tv?tmdb="}${id}${type === "tv" ? `&season=${season ?? 1}&episode=${episode ?? 1}` : ""}`;
}

export async function checkSourceHealth(): Promise<Record<string, { status: "online" | "offline"; latency?: number }>> {
  const results: Record<string, { status: "online" | "offline"; latency?: number }> = {};
  await Promise.allSettled(
    STREAMING_APIS.map(async (api) => {
      const start = Date.now();
      try {
        const res = await fetch(api.healthCheckUrl || api.baseUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(3000),
        });
        results[api.type] = {
          status: res.ok || res.status < 500 ? "online" : "offline",
          latency: Date.now() - start,
        };
      } catch {
        results[api.type] = {
          status: "offline",
          latency: Date.now() - start,
        };
      }
    })
  );
  return results;
}
