interface StreamingAPIConfig {
  name: string;
  baseUrl: string;
  type: string;
  quality: "Best" | "HD" | "Backup";
  supportsNativeFullscreen?: boolean;
  healthCheckUrl?: string;
}

const STREAMING_APIS: StreamingAPIConfig[] = [
  {
    name: "Source 1",
    baseUrl: "https://embed.smashystream.com",
    type: "smashy",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://embed.smashystream.com",
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
    baseUrl: "https://multiembed.mov",
    type: "multiembed",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://multiembed.mov",
  },
  {
    name: "Source 4",
    baseUrl: "https://www.2embed.cc",
    type: "twoembed",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://www.2embed.cc",
  },
];

function buildEmbedUrl(api: StreamingAPIConfig, type: "movie" | "tv", id: number, season?: number, episode?: number): string {
  switch (api.type) {
    case "smashy":
      if (type === "movie") return `${api.baseUrl}/playere.php?tmdb=${id}`;
      return `${api.baseUrl}/playere.php?tmdb=${id}&season=${season ?? 1}&episode=${episode ?? 1}`;

    case "vixsrc":
      if (type === "movie") return `${api.baseUrl}/movie/${id}`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "multiembed":
      if (type === "movie") return `${api.baseUrl}/?video_id=${id}&tmdb=1`;
      return `${api.baseUrl}/?video_id=${id}&s=${season ?? 1}&e=${episode ?? 1}&tmdb=1`;

    case "twoembed":
      if (type === "movie") return `${api.baseUrl}/embed/${id}`;
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    default:
      return "";
  }
}

export interface StreamingSource {
  url: string;
  name: string;
  type: string;
  quality: "Best" | "HD" | "Backup";
  supportsNativeFullscreen?: boolean;
}

export function getStreamingSources(type: "movie" | "tv", id: number, season?: number, episode?: number): StreamingSource[] {
  return STREAMING_APIS.map((api) => ({
    url: buildEmbedUrl(api, type, id, season, episode),
    name: api.name,
    type: api.type,
    quality: api.quality,
    supportsNativeFullscreen: api.supportsNativeFullscreen,
  }));
}

export function getPrimarySource(type: "movie" | "tv", id: number, season?: number, episode?: number): StreamingSource {
  const sources = getStreamingSources(type, id, season, episode);
  return sources[0];
}

// Server-side health check: returns map of source type -> alive status
export async function checkSourceHealth(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  const checks = STREAMING_APIS.map(async (api) => {
    try {
      const res = await fetch(api.healthCheckUrl || api.baseUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      results[api.type] = res.ok || res.status < 500;
    } catch {
      results[api.type] = false;
    }
  });
  await Promise.allSettled(checks);
  STREAMING_APIS.forEach((api) => {
    if (results[api.type] === undefined) results[api.type] = false;
  });
  return results;
}

// Get sources excluding known unhealthy ones
export async function getHealthySources(type: "movie" | "tv", id: number, season?: number, episode?: number): Promise<StreamingSource[]> {
  const health = await checkSourceHealth();
  return getStreamingSources(type, id, season, episode).filter((s) => health[s.type] !== false);
}
