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
    baseUrl: "https://vixsrc.to",
    type: "vixsrc",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vixsrc.to",
  },
  {
    name: "Source 2",
    baseUrl: "https://vidfast.pro",
    type: "vidfast",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidfast.pro",
  },
  {
    name: "Source 3",
    baseUrl: "https://vidlink.pro",
    type: "vidlink",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidlink.pro",
  },
  {
    name: "Source 4",
    baseUrl: "https://vidsrc.to",
    type: "vidsrc",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidsrc.to",
  },
  {
    name: "Source 5",
    baseUrl: "https://www.2embed.cc",
    type: "twoembed",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://www.2embed.cc",
  },
];

function buildEmbedUrl(api: StreamingAPIConfig, type: "movie" | "tv", id: number, season?: number, episode?: number): string {
  switch (api.type) {
    case "vixsrc":
      if (type === "movie") return `${api.baseUrl}/movie/${id}`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "twoembed":
      if (type === "movie") return `${api.baseUrl}/embed/${id}`;
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidlink":
      if (type === "movie") return `${api.baseUrl}/movie/${id}?primaryColor=4b5694`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}?primaryColor=4b5694`;

    case "vidsrc":
      if (type === "movie") return `${api.baseUrl}/embed/movie/${id}`;
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidfast":
      if (type === "movie") return `${api.baseUrl}/movie/${id}?autoPlay=true`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}?autoPlay=true`;

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
