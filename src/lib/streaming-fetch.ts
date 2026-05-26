interface StreamingAPIConfig {
  name: string;
  baseUrl: string;
  type: string;
  supportsNativeFullscreen?: boolean;
}

const STREAMING_APIS: StreamingAPIConfig[] = [
  {
    name: "CineSrc",
    baseUrl: "https://cinesrc.st",
    type: "cinesrc",
  },
  {
    name: "VidSrc (MOV)",
    baseUrl: "https://vidsrc.mov",
    type: "vidsrcmov",
  },
  {
    name: "VIDKING",
    baseUrl: "https://vidking.net",
    type: "vidking",
    supportsNativeFullscreen: true,
  },
  {
    name: "2Embed",
    baseUrl: "https://2embed.cc",
    type: "2embed",
  },
  {
    name: "MultiEmbed",
    baseUrl: "https://multiembed.mov",
    type: "multiembed",
    supportsNativeFullscreen: true,
  },
  {
    name: "Embed.su",
    baseUrl: "https://embed.su",
    type: "embedsu",
    supportsNativeFullscreen: true,
  },
];

function buildEmbedUrl(api: StreamingAPIConfig, type: "movie" | "tv", id: number, season?: number, episode?: number): string {
  switch (api.type) {
    case "cinesrc":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}?s=${season ?? 1}&e=${episode ?? 1}`;

    case "vidsrcmov":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "vidking":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "multiembed":
      if (type === "movie") {
        return `${api.baseUrl}/?video_id=${id}&tmdb=1`;
      }
      return `${api.baseUrl}/?video_id=${id}&tmdb=1&s=${season ?? 1}&e=${episode ?? 1}`;

    case "embedsu":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    case "2embed":
      if (type === "movie") {
        return `${api.baseUrl}/embed/${id}`;
      }
      return `${api.baseUrl}/embed/${id}/${season ?? 1}/${episode ?? 1}`;

    case "autoembed":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;

    default:
      return "";
  }
}

export interface StreamingSource {
  url: string;
  name: string;
  type: string;
  supportsNativeFullscreen?: boolean;
}

export function getStreamingSources(type: "movie" | "tv", id: number, season?: number, episode?: number): StreamingSource[] {
  return STREAMING_APIS.map((api) => ({
    url: buildEmbedUrl(api, type, id, season, episode),
    name: api.name,
    type: api.type,
    supportsNativeFullscreen: api.supportsNativeFullscreen,
  }));
}

export function getPrimarySource(type: "movie" | "tv", id: number, season?: number, episode?: number): StreamingSource {
  const sources = getStreamingSources(type, id, season, episode);
  return sources[0];
}
