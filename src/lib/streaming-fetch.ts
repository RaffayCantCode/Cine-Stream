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
    baseUrl: "https://cinesrc.st",
    type: "cinesrc",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://cinesrc.st",
  },
  {
    name: "Source 2",
    baseUrl: "https://vidsrc.fyi",
    type: "vidsrcfyi",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidsrc.fyi",
  },
  {
    name: "Source 3",
    baseUrl: "https://vidsrc.mov",
    type: "vidsrcmov",
    quality: "Best",
    healthCheckUrl: "https://vidsrc.mov",
  },
  {
    name: "Source 4",
    baseUrl: "https://vidlink.pro",
    type: "vidlink",
    quality: "HD",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidlink.pro",
  },
  {
    name: "Source 5",
    baseUrl: "https://vidsrc.to",
    type: "vidsrcto",
    quality: "HD",
    healthCheckUrl: "https://vidsrc.to",
  },
];

function buildEmbedUrl(api: StreamingAPIConfig, type: "movie" | "tv", id: number, season?: number, episode?: number): string {
  switch (api.type) {
    case "cinesrc":
      if (type === "movie") return `${api.baseUrl}/embed/movie/${id}`;
      return `${api.baseUrl}/embed/tv/${id}?s=${season ?? 1}&e=${episode ?? 1}`;

    case "vidsrcfyi":
      if (type === "movie") return `${api.baseUrl}/embed/movie/${id}`;
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidsrcmov":
      if (type === "movie") return `${api.baseUrl}/embed/movie/${id}`;
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidlink":
      if (type === "movie") return `${api.baseUrl}/movie/${id}`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidsrcto":
      if (type === "movie") return `${api.baseUrl}/embed/movie/${id}`;
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
