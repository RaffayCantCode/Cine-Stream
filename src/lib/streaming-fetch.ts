// Multi-API Streaming Fetcher for Movies & TV
// Sources tested and working

interface StreamingAPIConfig {
  name: string;
  baseUrl: string;
  type: "2embed" | "vidsrcembed" | "vidking" | "vidsrcin";
}

const STREAMING_APIS: StreamingAPIConfig[] = [
  {
    name: "2Embed",
    baseUrl: "https://www.2embed.cc",
    type: "2embed",
  },
  {
    name: "VidSrc",
    baseUrl: "https://vidsrc-embed.ru",
    type: "vidsrcembed",
  },
  {
    name: "VidKing",
    baseUrl: "https://www.vidking.net",
    type: "vidking",
  },
  {
    name: "VidSrc.in",
    baseUrl: "https://vidsrc.in",
    type: "vidsrcin",
  },
];

// Build embed URL based on API type
function buildEmbedUrl(api: StreamingAPIConfig, type: "movie" | "tv", id: number, season?: number, episode?: number): string {
  switch (api.type) {
    case "2embed":
      if (type === "movie") {
        return `${api.baseUrl}/embed/${id}`;
      }
      return `${api.baseUrl}/embedtv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "vidsrcembed":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "vidking":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "vidsrcin":
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
}

// Get streaming sources for movies/TV
export function getStreamingSources(type: "movie" | "tv", id: number, season?: number, episode?: number): StreamingSource[] {
  return STREAMING_APIS.map(api => ({
    url: buildEmbedUrl(api, type, id, season, episode),
    name: api.name,
    type: api.type,
  }));
}

// Get primary source (first one)
export function getPrimarySource(type: "movie" | "tv", id: number, season?: number, episode?: number): StreamingSource {
  const sources = getStreamingSources(type, id, season, episode);
  return sources[0];
}