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
    baseUrl: "https://vidsrc.to",
    type: "vidsrcto",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidsrc.to",
  },
  {
    name: "Source 2",
    baseUrl: "https://vidlink.pro",
    type: "vidlink",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidlink.pro",
  },
  {
    name: "Source 3",
    baseUrl: "https://www.2embed.cc",
    type: "twoembed",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://www.2embed.cc",
  },
];

function buildEmbedUrl(api: StreamingAPIConfig, type: "movie" | "tv", id: number, season?: number, episode?: number): string {
  switch (api.type) {
    case "vidsrcto":
      if (type === "movie") return `${api.baseUrl}/embed/movie/${id}`;
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidlink":
      if (type === "movie") return `${api.baseUrl}/movie/${id}?primaryColor=4b5694`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}?primaryColor=4b5694`;

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
