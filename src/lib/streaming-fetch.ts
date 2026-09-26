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
    baseUrl: "https://embedmaster.link",
    type: "embedmaster",
    quality: "Best",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://embedmaster.link",
  },
  {
    name: "Source 2",
    baseUrl: "https://player.vidlove.cc",
    type: "vidlove",
    quality: "Good",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://player.vidlove.cc",
  },
  {
    name: "Source 3",
    baseUrl: "https://vidlink.pro",
    type: "vidlink",
    quality: "Good",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidlink.pro",
  },
  {
    name: "Source 4",
    baseUrl: "https://vidsrc.sh",
    type: "vidsrc",
    quality: "Good",
    supportsNativeFullscreen: true,
    healthCheckUrl: "https://vidsrc.sh",
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

    case "vidlove":
      if (type === "movie") return `${api.baseUrl}/embed/movie/${id}`;
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "bingr":
      if (type === "movie") return `${api.baseUrl}/watch/movie/${id}`;
      return `${api.baseUrl}/watch/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vixsrc":
      if (type === "movie") return `${api.baseUrl}/movie/${id}`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidlink":
      if (type === "movie") return `${api.baseUrl}/movie/${id}`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidsrc":
      if (type === "movie") return `${api.baseUrl}/embed/movie/${id}`;
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "autoembed":
      if (type === "movie") return `${api.baseUrl}/movie/tmdb/${id}?color=8B5CF6&lang=en`;
      return `${api.baseUrl}/tv/tmdb/${id}-${season ?? 1}-${episode ?? 1}?color=8B5CF6&lang=en`;

    case "videasy":
      if (type === "movie") return `${api.baseUrl}/movie/${id}?color=8B5CF6`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}?color=8B5CF6`;

    case "vidcore":
      if (type === "movie") return `${api.baseUrl}/embed/movie/${id}`;
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidnest":
      if (type === "movie") return `${api.baseUrl}/movie/${id}`;
      return `${api.baseUrl}/tv/${id}/${season ?? 1}/${episode ?? 1}`;

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
  const defaultMovieTags: Record<string, string> = {
    embedmaster: "best",
    vidlove: "good",
    vidlink: "good",
    vidsrc: "good",
    autoembed: "backup",
  };
  return STREAMING_APIS.map((api) => ({
    url: buildEmbedUrl(api, type, id, season, episode, progress),
    name: api.name,
    type: api.type,
    quality: api.quality,
    tag: defaultMovieTags[api.type] || api.quality.toLowerCase(),
    supportsNativeFullscreen: api.supportsNativeFullscreen,
  }));
}

export function getFallbackEmbedUrl(type: "movie" | "tv", id: number, season?: number, episode?: number): string {
  return type === "movie"
    ? `https://embedmaster.link/movie/${id}`
    : `https://embedmaster.link/tv/${id}/${season ?? 1}/${episode ?? 1}`;
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
