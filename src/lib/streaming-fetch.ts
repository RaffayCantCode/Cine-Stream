// Multi-API Streaming Fetcher for Movies & TV
// Working sources as of May 2026

interface StreamingAPIConfig {
  name: string;
  baseUrl: string;
  type: string;
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
    name: "VidSrc ME",
    baseUrl: "https://vidsrc.me",
    type: "vidsrcme",
  },
  {
    name: "SuperStream",
    baseUrl: "https://superstream.se",
    type: "superstream",
  },
  {
    name: "VidKing",
    baseUrl: "https://vidking.net",
    type: "vidking",
  },
];

// Build embed URL based on API type
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
    
    case "vidsrcme":
      if (type === "movie") {
        return `${api.baseUrl}/embed/movie/${id}`;
      }
      return `${api.baseUrl}/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
    
    case "superstream":
      if (type === "movie") {
        return `${api.baseUrl}/embed/${id}`;
      }
      return `${api.baseUrl}/embed/${id}?season=${season ?? 1}&episode=${episode ?? 1}`;
    
    case "vidking":
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