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
    baseUrl: "https://vixsrc.to",
    type: "vixsrc",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vixsrc.to",
  },
  {
    name: "Source 3",
    baseUrl: "https://player.videasy.net",
    type: "videasy",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://player.videasy.net",
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
    case "videasy":
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

export function getPrimarySource(type: "movie" | "tv", id: number, season?: number, episode?: number, progress?: number): StreamingSource {
  const sources = getStreamingSources(type, id, season, episode, progress);
  return sources[0];
}

const healthCache = {
  data: null as Record<string, boolean> | null,
  expires: 0
};

// Server-side health check: returns map of source type -> alive status
// Only marks source as dead if it fails to respond at all (network error / timeout).
// Non-2xx responses are still OK - embed root paths often return 403/404 but
// the actual embed URLs work fine.
export async function checkSourceHealth(): Promise<Record<string, boolean>> {
  if (healthCache.data && healthCache.expires > Date.now()) {
    return healthCache.data;
  }

  const results: Record<string, boolean> = {};
  const checks = STREAMING_APIS.map(async (api) => {
    try {
      const res = await fetch(api.healthCheckUrl || api.baseUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      results[api.type] = true;
    } catch {
      results[api.type] = false;
    }
  });
  await Promise.allSettled(checks);
  STREAMING_APIS.forEach((api) => {
    if (results[api.type] === undefined) results[api.type] = true;
  });

  healthCache.data = results;
  healthCache.expires = Date.now() + 600000; // Cache for 10 minutes

  return results;
}

// Get sources excluding known unhealthy ones
export async function getHealthySources(type: "movie" | "tv", id: number, season?: number, episode?: number): Promise<StreamingSource[]> {
  const health = await checkSourceHealth();
  return getStreamingSources(type, id, season, episode).filter((s) => health[s.type] !== false);
}
